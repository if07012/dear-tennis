'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ClockSmallIcon,
  MapPinIcon,
  UsersSmallIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import { formatActivityTime } from '@/lib/activity-utils';
import { JoinConfirmDialog } from '@/components/ui/JoinConfirmDialog';
import type { ActivityItem } from '@/data/activities-types';
import type { SignupStatus } from '@/data/activity-signups-types';
import type { MatchRecord } from '@/data/matches-types';

const TAG_STYLES: Record<string, string> = {
  training: 'bg-white text-hunter-green border border-hunter-green/30',
  social: 'bg-white text-teal border border-teal/30',
  competitive: 'bg-white text-paprika border border-paprika/30',
};

const ROUND_LABEL: Record<string, string> = {
  RR: 'Round Robin',
  R1: 'Round 1',
  QF: 'Quarter Final',
  SF: 'Semi Final',
  F: 'Final',
  manual: 'Match',
};

export type ActivityMemberView = {
  email: string;
  name: string;
  photo: string | null;
  rank: string | null;
};

type Props = {
  activity: ActivityItem | null;
  members: ActivityMemberView[];
  matches: MatchRecord[];
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarBgFor(name: string): string {
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

function setScore(m: MatchRecord): string {
  const sets = [
    [m.set1A, m.set1B],
    [m.set2A, m.set2B],
    [m.set3A, m.set3B],
  ].filter(([x, y]) => x > 0 || y > 0);
  if (sets.length === 0) return '-';
  return sets.map(([x, y]) => `${x}-${y}`).join(', ');
}

function MatchRow({ m, nameOf }: { m: MatchRecord; nameOf: (email: string) => string }) {
  const sideA = m.sideA.split(',').map(nameOf).join(' & ');
  const sideB = m.sideB.split(',').map(nameOf).join(' & ');
  const aWon = m.winner === 'A';
  const bWon = m.winner === 'B';
  return (
    <li className="flex flex-col gap-1 rounded-md border border-light-gray bg-off-white px-3 py-2 text-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-dark-gray">
        <span className="rounded-full bg-white px-2 py-0.5 uppercase tracking-wider text-[0.65rem]">
          {ROUND_LABEL[m.round] ?? m.round}
        </span>
        {m.isDoubles && (
          <span className="rounded-full bg-hunter-green/10 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-hunter-green">
            2v2
          </span>
        )}
        {m.winner === 'draw' && (
          <span className="rounded-full bg-dark-gray/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
            Draw
          </span>
        )}
        <span className="flex-1" />
        <span className="font-mono text-sm font-semibold text-hunter-green tabular-nums">
          {setScore(m)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 pl-1 text-sm">
        <span className={aWon ? 'font-semibold text-hunter-green' : 'text-dark-gray'}>
          {sideA} {aWon ? ' ✓' : ''}
        </span>
        <span className={bWon ? 'font-semibold text-hunter-green' : 'text-dark-gray'}>
          {sideB} {bWon ? ' ✓' : ''}
        </span>
      </div>
    </li>
  );
}

export function ActivityDetailClient({ activity, members, matches }: Props) {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<SignupStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Preload the current user's signup state for this activity.
  useEffect(() => {
    if (!activity) return;
    if (!isAuthenticated || !user?.email) {
      setStatus(null);
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
        const found = body.signups.find((s) => s.activityId === activity.id);
        setStatus(found ? found.status : null);
      } catch {
        // Silent — Join button still works; status just won't preload.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activity, isAuthenticated, user?.email]);

  const join = useCallback(async () => {
    if (!activity || !user?.email) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/activity-signups', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user.email,
        },
        body: JSON.stringify({ activityId: activity.id }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        signup?: { status: SignupStatus };
        error?: string;
      };
      if (!res.ok || !body.ok || !body.signup) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setStatus(body.signup.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mendaftar');
    } finally {
      setPending(false);
    }
  }, [activity, user?.email]);

  if (!activity) {
    return (
      <div className="section-padding bg-white">
        <div className="container-base py-16 text-center">
          <h1 className="font-serif text-3xl font-semibold text-hunter-green mb-4">
            Activity tidak ditemukan
          </h1>
          <p className="text-dark-gray mb-8">
            Activity mungkin sudah dihapus atau diarsipkan.
          </p>
          <Link
            href="/#activities"
            className="inline-flex rounded-full bg-paprika px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-paprika-hover"
          >
            Lihat semua activity
          </Link>
        </div>
      </div>
    );
  }

  // Match sides store emails (or __manual_<name>@guest.local slugs).
  const memberNames = new Map(members.map((m) => [m.email.toLowerCase(), m.name]));
  const nameOf = (email: string) => {
    const key = email.trim().toLowerCase();
    const member = memberNames.get(key);
    if (member) return member;
    if (key.startsWith('__manual_')) return key.slice('__manual_'.length).split('@')[0];
    return key;
  };

  return (
    <div className="bg-white">
      {/* Hero — activity image full-width with title overlay */}
      <div className="relative h-[40vh] min-h-72 w-full overflow-hidden sm:h-[50vh]">
        {activity.image ? (
          <Image
            src={activity.image}
            alt={activity.title}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-hunter-green text-sm text-white">
            {activity.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-graphite/80 via-graphite/30 to-transparent" />
        <span
          className={[
            'absolute top-6 left-6 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider',
            TAG_STYLES[activity.category] ?? TAG_STYLES.training,
          ].join(' ')}
        >
          {activity.category}
        </span>
        <div className="absolute inset-x-0 bottom-0">
          <div className="container-base pb-6">
            <Link
              href="/#activities"
              className="mb-3 inline-flex text-xs font-semibold uppercase tracking-wider text-white/80 transition-colors hover:text-white"
            >
              ← Kembali ke activities
            </Link>
            <h1 className="font-serif text-3xl font-semibold text-white drop-shadow sm:text-5xl">
              {activity.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="container-base py-8 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <article className="min-w-0">
            <h2 className="font-serif text-xl font-semibold text-hunter-green mb-3">
              Deskripsi
            </h2>
            <p className="text-dark-gray leading-relaxed whitespace-pre-line text-pretty">
              {activity.description || 'Belum ada deskripsi.'}
            </p>

            {activity.category === 'competitive' && matches.length > 0 && (
              <section className="mt-10">
                <h2 className="font-serif text-xl font-semibold text-hunter-green mb-4">
                  Hasil Match
                </h2>
                <ul className="flex flex-col gap-2">
                  {matches.map((m) => (
                    <MatchRow key={m.id} m={m} nameOf={nameOf} />
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-10">
              <h2 className="font-serif text-xl font-semibold text-hunter-green mb-4">
                Member Terdaftar ({members.length})
              </h2>
              {members.length === 0 ? (
                <p className="text-sm text-dark-gray">
                  Belum ada member yang terdaftar.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {members.map((m) => (
                    <li
                      key={`${m.email}-${m.name}`}
                      className="flex items-center gap-3 rounded-lg border border-light-gray bg-white px-3 py-2"
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
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-hunter-green">
                          {m.name}
                        </p>
                        {m.rank && (
                          <p className="text-xs text-dark-gray">{m.rank}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>

          <aside className="h-fit rounded-2xl border border-light-gray p-6 lg:sticky lg:top-24">
            <h2 className="font-serif text-lg font-semibold text-hunter-green mb-4">
              Info &amp; Pendaftaran
            </h2>
            <div className="flex flex-col gap-3 text-sm text-dark-gray">
              {activity.time && (
                <span className="inline-flex items-center gap-2">
                  <ClockSmallIcon />
                  {formatActivityTime(activity.time)}
                </span>
              )}
              {activity.duration && (
                <span className="inline-flex items-center gap-2">
                  <ClockSmallIcon />
                  {activity.duration}
                </span>
              )}
              {activity.location && (
                <span className="inline-flex items-center gap-2">
                  <MapPinIcon />
                  {activity.location}
                </span>
              )}
              {activity.groupSize && (
                <span className="inline-flex items-center gap-2">
                  <UsersSmallIcon />
                  {activity.groupSize}
                </span>
              )}
            </div>

            {activity.price && (
              <div className="mt-4 rounded-lg border border-light-gray bg-off-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  Harga
                </p>
                <p className="mt-1 font-serif text-xl font-bold text-hunter-green">
                  {activity.price}
                </p>
              </div>
            )}

            <div className="mt-6 border-t border-light-gray pt-5">
              {activity.isFull ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-light-gray px-4 py-2.5 text-sm font-semibold text-dark-gray"
                >
                  Full Book
                </button>
              ) : !isAuthenticated ? (
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover"
                >
                  Login untuk Join
                </Link>
              ) : status === 'approved' ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-hunter-green/10 px-4 py-2.5 text-sm font-semibold text-hunter-green"
                >
                  ✓ Kamu sudah terdaftar
                </button>
              ) : status === 'pending' ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-full bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800"
                >
                  Menunggu persetujuan admin
                </button>
              ) : status === 'rejected' ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-full bg-paprika/10 px-4 py-2.5 text-sm font-semibold text-paprika"
                  >
                    ✗ Pendaftaran ditolak
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    disabled={pending}
                    className="w-full rounded-full border border-paprika px-4 py-2.5 text-sm font-semibold text-paprika transition-colors hover:bg-paprika hover:text-white disabled:opacity-60"
                  >
                    {pending ? 'Mengirim...' : 'Daftar lagi'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={pending}
                  className="w-full rounded-full bg-paprika px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-paprika-hover hover:shadow-md disabled:opacity-60"
                >
                  {pending ? 'Mengirim...' : 'Join Activity'}
                </button>
              )}

              {error && (
                <p role="alert" className="mt-3 text-center text-xs font-semibold text-paprika">
                  {error}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <JoinConfirmDialog
        activity={
          confirming
            ? {
                title: activity.title,
                time: activity.time || undefined,
                location: activity.location || undefined,
                price: activity.price || undefined,
              }
            : null
        }
        pending={pending}
        onConfirm={() => {
          setConfirming(false);
          join();
        }}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
