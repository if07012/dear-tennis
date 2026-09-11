'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  ClockSmallIcon,
  MapPinIcon,
  UsersSmallIcon,
  XIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { activityPath } from '@/lib/slug';
import { formatActivityTime } from '@/lib/activity-utils';
import { JoinConfirmDialog, type JoinConfirmInfo, type JoinCouponOption } from '@/components/ui/JoinConfirmDialog';
import type {
  ActivityCategory,
  ActivityItem,
  ActivitiesSettings,
} from '@/data/activities-types';
import type { SignupStatus } from '@/data/activity-signups-types';

type Filter = ActivityCategory | 'all';

// datetime-local strings sort naturally; free-text times don't parse and
// get Infinity so undated legacy rows sink to the end, newest first.
function activityTimeValue(raw: string): number {
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

const TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All Activities' },
  { id: 'training', label: 'Training' },
  { id: 'social', label: 'Social Play' },
  { id: 'competitive', label: 'Competitive' },
];

const TAG_STYLES: Record<ActivityCategory, string> = {
  training: 'bg-white text-hunter-green border border-hunter-green/30',
  social: 'bg-white text-teal border border-teal/30',
  competitive: 'bg-white text-paprika border border-paprika/30',
};

type Props = {
  settings: ActivitiesSettings;
  activities: ActivityItem[];
  limit?: number;
};

type SignupMap = Map<string, SignupStatus>;

type ActivityStatusProps = {
  activityId: string;
  status: SignupStatus | null;
  pending: boolean;
  onJoin: () => void;
  isFull?: boolean;
  detailHref?: string;
};

export function Activities({ settings, activities, limit = 6 }: Props) {
  const [active, setActive] = useState<Filter>('all');
  const { user, isAuthenticated } = useAuth();
  const [signups, setSignups] = useState<SignupMap>(new Map());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signupCounts, setSignupCounts] = useState<Record<string, number>>({});
  const [occupiedCounts, setOccupiedCounts] = useState<Record<string, number>>({});
  const [openActivityId, setOpenActivityId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Public, anonymous — show how many members have joined each card. We
  // fetch once on mount; the count only changes when the admin approves a
  // signup so a per-render refresh would be wasteful.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/activity-signups/counts', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          counts?: Record<string, number>;
          occupied?: Record<string, number>;
        };
        if (cancelled) return;
        setSignupCounts(body.counts ?? {});
        setOccupiedCounts(body.occupied ?? {});
      } catch {
        // Non-fatal — the count line just stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load the current user's signup state once on mount (when logged in)
  // and refresh whenever the auth identity changes — the cached map keeps
  // every card's button in the right state without a fetch per card.
  useEffect(() => {
    if (!isAuthenticated || !user?.email) {
      setSignups(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/activity-signups/mine', {
          headers: { 'x-auth-email': user.email },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const body = (await res.json()) as {
          signups: Array<{ activityId: string; status: SignupStatus }>;
        };
        if (cancelled) return;
        const next = new Map<string, SignupStatus>();
        // Later rows win — re-join after reject/cancel overwrites old status.
        for (const s of body.signups) next.set(s.activityId, s.status);
        setSignups(next);
      } catch {
        // Silent — Join button will still work; status just won't preload.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.email]);

  const join = useCallback(
    async (activityId: string, couponCode?: string) => {
      if (!user?.email) return;
      setPendingId(activityId);
      setError(null);
      try {
        const res = await fetch('/api/activity-signups', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-auth-email': user.email,
          },
          body: JSON.stringify({ activityId, couponCode }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          signup?: { status: SignupStatus };
          error?: string;
        };
        if (!res.ok || !body.ok || !body.signup) {
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setSignups((prev) => {
          const next = new Map(prev);
          next.set(activityId, body.signup!.status);
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal mendaftar');
      } finally {
        setPendingId(null);
      }
    },
    [user?.email],
  );

  // Public home page never shows archived activities — admin flips the
  // archive flag in /admin/activities-list to remove a card here — and
  // only shows activities within the next 7 days, soonest first.
  const publicActivities = useMemo(() => {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    return activities
      .filter(
        (a) =>
          a.archived !== true &&
          activityTimeValue(a.time) >= now &&
          activityTimeValue(a.time) <= now + oneWeek,
      )
      .sort((a, b) => activityTimeValue(a.time) - activityTimeValue(b.time));
  }, [activities]);
  const filtered =
    active === 'all'
      ? publicActivities
      : publicActivities.filter((a) => a.category === active);
  const visible = filtered.slice(0, limit);

  const visibleIds = useMemo(
    () => new Set(visible.map((a) => a.id)),
    [visible],
  );

  const openActivity = openActivityId
    ? activities.find((a) => a.id === openActivityId) ?? null
    : null;
  const confirmActivity = confirmId
    ? activities.find((a) => a.id === confirmId) ?? null
    : null;
  const confirmInfo: JoinConfirmInfo | null = confirmActivity
    ? {
        title: confirmActivity.title,
        time: confirmActivity.time || undefined,
        location: confirmActivity.location || undefined,
        price: confirmActivity.price || undefined,
      }
    : null;

  // Coupon choices load when the confirm dialog opens (priced activities
  // only); undefined = still loading / not applicable, [] = none available.
  const [confirmCoupons, setConfirmCoupons] = useState<
    JoinCouponOption[] | undefined
  >(undefined);
  useEffect(() => {
    if (!confirmActivity || !user?.email) {
      setConfirmCoupons(undefined);
      return;
    }
    const priceAmount = Number(
      (confirmActivity.price ?? '').replace(/[^\d]/g, ''),
    );
    if (!priceAmount) {
      setConfirmCoupons(undefined);
      return;
    }
    let cancelled = false;
    setConfirmCoupons(undefined);
    (async () => {
      try {
        const res = await fetch(
          `/api/coupons/eligible?activityId=${encodeURIComponent(confirmActivity.id)}`,
          { headers: { 'x-auth-email': user.email }, cache: 'no-store' },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { coupons?: JoinCouponOption[] };
        if (!cancelled) setConfirmCoupons(body.coupons ?? []);
      } catch {
        if (!cancelled) setConfirmCoupons([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmId, user?.email]);

  return (
    <section id="activities" className="section-padding bg-white">
      <div className="container-base">
        <SectionHeader
          tag={settings.tag || 'What We Do'}
          title={settings.title || 'Activities & Programs'}
          subtitle={settings.subtitle || undefined}
          center
        />

        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={[
                'px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200',
                active === tab.id
                  ? 'bg-paprika text-white shadow-md'
                  : 'bg-off-white text-graphite hover:bg-light-gray',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isAuthenticated && error && (
          <div
            role="alert"
            className="mb-6 mx-auto max-w-md rounded-lg border border-paprika/30 bg-paprika/10 px-4 py-2 text-center text-xs font-semibold text-paprika"
          >
            {error}
          </div>
        )}

        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {visible.map((activity, i) => (
              <motion.article
                layout
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col bg-white rounded-2xl overflow-hidden border border-light-gray hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="relative h-52 overflow-hidden">
                  {activity.image ? (
                    <Image
                      src={activity.image}
                      alt={activity.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-off-white text-sm text-dark-gray">
                      No image
                    </div>
                  )}
                  <span
                    className={[
                      'absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
                      TAG_STYLES[activity.category],
                    ].join(' ')}
                  >
                    {activity.category}
                  </span>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="font-serif text-xl font-semibold text-hunter-green mb-2">
                    <Link
                      href={activityPath(activity.id, activity.title)}
                      className="transition-colors hover:text-paprika"
                    >
                      {activity.title}
                    </Link>
                  </h3>
                  <p className="text-dark-gray text-sm leading-relaxed mb-4 text-pretty line-clamp-3">
                    {activity.description}
                  </p>
                  {activity.description.length > 120 && (
                    <Link
                      href={activityPath(activity.id, activity.title)}
                      className="mb-4 self-start text-xs font-semibold text-paprika transition-colors hover:text-paprika-hover"
                    >
                      More Detail
                    </Link>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-dark-gray mb-4">
                    {activity.price && (
                      <span className="inline-flex items-center gap-1.5 font-semibold text-hunter-green">
                        {activity.price}
                      </span>
                    )}
                    {activity.duration && (
                      <span className="inline-flex items-center gap-1.5">
                        <ClockSmallIcon />
                        {activity.duration}
                      </span>
                    )}
                    {activity.time && (
                      <span className="inline-flex items-center gap-1.5">
                        <ClockSmallIcon />
                        {formatActivityTime(activity.time)}
                      </span>
                    )}
                    {activity.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPinIcon />
                        {activity.location}
                      </span>
                    )}
                    {activity.groupSize && (
                      <span className="inline-flex items-center gap-1.5">
                        <UsersSmallIcon />
                        {activity.groupSize}
                      </span>
                    )}
                  </div>
                  {signupCounts[activity.id] !== undefined && signupCounts[activity.id] > 0 && (
                    <button
                      type="button"
                      onClick={() => setOpenActivityId(activity.id)}
                      className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-hunter-green/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
                    >
                      <UsersSmallIcon />
                      {signupCounts[activity.id]} terdaftar · lihat
                    </button>
                  )}
                  {(() => {
                    // Slots remaining = capacity − slot-occupying signups
                    // (joined + waiting payment + payment submitted, PRD §15).
                    const capMatch = (activity.groupSize ?? '').match(/\d+/);
                    const cap = capMatch ? Number.parseInt(capMatch[0], 10) : 0;
                    if (!cap) return null;
                    const occupied = occupiedCounts[activity.id] ?? 0;
                    return (
                      <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-dark-gray">
                        {Math.max(0, cap - occupied)} dari {cap} slot tersisa
                      </p>
                    );
                  })()}
                  {isAuthenticated && visibleIds.has(activity.id) && (
                    <ActivityJoinButton
                      activityId={activity.id}
                      status={signups.get(activity.id) ?? null}
                      pending={pendingId === activity.id}
                      onJoin={() => setConfirmId(activity.id)}
                      isFull={activity.isFull}
                      detailHref={activityPath(activity.id, activity.title)}
                    />
                  )}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <MembersModal
        activityId={openActivityId}
        activityTitle={openActivity?.title ?? ''}
        onClose={() => setOpenActivityId(null)}
      />

      <JoinConfirmDialog
        activity={confirmInfo}
        coupons={confirmCoupons}
        pending={confirmId !== null && pendingId === confirmId}
        onConfirm={(couponCode) => {
          if (confirmId) {
            void join(confirmId, couponCode);
            setConfirmId(null);
          }
        }}
        onClose={() => setConfirmId(null)}
      />
    </section>
  );
}

function ActivityJoinButton({
  status,
  pending,
  onJoin,
  isFull = false,
  detailHref,
}: ActivityStatusProps) {
  if (isFull) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center rounded-full bg-light-gray px-4 py-2 text-xs font-semibold text-dark-gray"
      >
        Full Book
      </button>
    );
  }
  if (status === 'joined') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-hunter-green/10 px-4 py-2 text-xs font-semibold text-hunter-green"
      >
        ✓ Kamu sudah terdaftar
      </button>
    );
  }
  if (status === 'pending_approval') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center rounded-full bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-800"
      >
        Menunggu persetujuan admin
      </button>
    );
  }
  if (status === 'waiting_payment') {
    // Payment happens on the detail page — send the member there.
    return (
      <Link
        href={detailHref ?? '#activities'}
        className="inline-flex w-full items-center justify-center rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-200"
      >
        Lakukan pembayaran →
      </Link>
    );
  }
  if (status === 'payment_submitted') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex w-full items-center justify-center rounded-full bg-sky-100 px-4 py-2 text-xs font-semibold text-sky-800"
      >
        Menunggu Pembayaran diverifikasi
      </button>
    );
  }
  if (status === 'rejected' || status === 'cancelled' || status === 'expired') {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          className="inline-flex w-full items-center justify-center rounded-full bg-paprika/10 px-4 py-2 text-xs font-semibold text-paprika"
        >
          ✗ Pendaftaran ditolak
        </button>
        <button
          type="button"
          onClick={onJoin}
          disabled={pending}
          className="inline-flex w-full items-center justify-center rounded-full border border-paprika px-4 py-2 text-xs font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-60"
        >
          {pending ? 'Mengirim...' : 'Daftar lagi'}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onJoin}
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-full bg-paprika px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover hover:shadow-md disabled:opacity-60"
    >
      {pending ? 'Mengirim...' : 'Join'}
    </button>
  );
}

type Member = { name: string; photo: string | null; joinedAt: string };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarBgFor(name: string): string {
  // Deterministic, light tinted background keyed on the name so the
  // initials chip looks stable per member across renders.
  const palette = [
    'bg-hunter-green/15 text-hunter-green',
    'bg-teal/15 text-teal',
    'bg-paprika/15 text-paprika',
    'bg-amber-100 text-amber-800',
    'bg-sky-100 text-sky-800',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function MembersModal({
  activityId,
  activityTitle,
  onClose,
}: {
  activityId: string | null;
  activityTitle: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) {
      setMembers(null);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/activity-signups/${encodeURIComponent(activityId)}/members`,
          { cache: 'no-store' },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { members?: Member[] };
        if (cancelled) return;
        setMembers(body.members ?? []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Gagal memuat data');
        setMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  useEffect(() => {
    if (!activityId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [activityId, onClose]);

  if (!activityId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-graphite/50 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Member activity ${activityTitle}`}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-light-gray px-5 py-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-paprika">
              Member terdaftar
            </p>
            <h3 className="font-serif text-lg font-semibold text-hunter-green">
              {activityTitle || 'Activity'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-light-gray"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {members === null && (
            <p className="text-center text-sm text-dark-gray">Memuat...</p>
          )}
          {error && (
            <p className="text-center text-sm text-paprika">{error}</p>
          )}
          {members !== null && members.length === 0 && !error && (
            <p className="text-center text-sm text-dark-gray">
              Belum ada member yang terdaftar.
            </p>
          )}
          {members !== null && members.length > 0 && (
            <ul className="flex flex-col gap-3">
              {members.map((m) => (
                <li
                  key={`${m.name}-${m.joinedAt}`}
                  className="flex items-center gap-3"
                >
                  {m.photo ? (
                    <Image
                      src={m.photo}
                      alt={m.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className={[
                        'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        avatarBgFor(m.name),
                      ].join(' ')}
                      aria-hidden="true"
                    >
                      {initialsOf(m.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-hunter-green">
                      {m.name}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

