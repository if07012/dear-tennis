'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ChevronUp,
  PlusIcon,
  XIcon,
} from '@/components/ui/Icons';
import {
  UsersIcon,
  LightningIcon,
  CalendarIcon,
  LayersIcon,
  ClockIcon,
  HeartIcon,
  TrophyIcon,
  StarIcon,
  TargetIcon,
  SparklesIcon,
} from '@/components/ui/Icons';
import { useAuth } from '@/hooks/useAuth';
import type {
  BenefitIconKey,
  BenefitItem,
  WhyJoinContent,
  WhyJoinSettings,
} from '@/data/why-join-types';

const ICON_PICKER: Array<{ key: BenefitIconKey; label: string; Icon: typeof UsersIcon }> = [
  { key: 'users', label: 'Users', Icon: UsersIcon },
  { key: 'lightning', label: 'Lightning', Icon: LightningIcon },
  { key: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { key: 'layers', label: 'Layers', Icon: LayersIcon },
  { key: 'clock', label: 'Clock', Icon: ClockIcon },
  { key: 'heart', label: 'Heart', Icon: HeartIcon },
  { key: 'trophy', label: 'Trophy', Icon: TrophyIcon },
  { key: 'star', label: 'Star', Icon: StarIcon },
  { key: 'target', label: 'Target', Icon: TargetIcon },
  { key: 'sparkles', label: 'Sparkles', Icon: SparklesIcon },
];

type SettingsDraft = Omit<WhyJoinSettings, 'id' | 'updatedAt'>;

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'admin.why-join.draft';

type Draft = { settings: SettingsDraft; benefits: BenefitItem[] };

function readDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  if (typeof window === 'undefined') return;
  if (draft) {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } else {
    window.localStorage.removeItem(DRAFT_KEY);
  }
}

function isPersistedBenefitId(id: string) {
  // UUIDs are 36 chars; first persisted creation yields a UUID.
  return id.length > 24;
}

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

export function WhyJoinEditorClient({ initial }: { initial: WhyJoinContent }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsDraft>({
    tag: initial.settings.tag,
    title: initial.settings.title,
    subtitle: initial.settings.subtitle,
  });
  const [benefits, setBenefits] = useState<BenefitItem[]>(initial.benefits);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = readDraft();
    if (d) {
      setSettings(d.settings);
      setBenefits(d.benefits);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings, benefits });
  }, [hydrated, settings, benefits]);

  const apiFetch = useCallback(
    async (
      kind: 'settings' | 'benefit' | 'reorder' | 'delete',
      payload: Record<string, unknown>,
      method: 'PUT' | 'DELETE' = 'PUT',
    ) => {
      const res = await fetch('/api/why-join', {
        method,
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify({ kind, ...payload }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [user?.email],
  );

  const setSettingsField = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setStatus({ kind: 'idle' });
  };

  const addBenefit = () => {
    setBenefits((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: '',
        description: '',
        icon: 'users',
        order: prev.length,
      },
    ]);
    setStatus({ kind: 'idle' });
  };

  const updateBenefit = (id: string, patch: Partial<BenefitItem>) => {
    setBenefits((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    );
    setStatus({ kind: 'idle' });
  };

  const removeBenefit = async (id: string) => {
    const isPersisted = isPersistedBenefitId(id);
    if (!isPersisted) {
      setBenefits((prev) =>
        prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })),
      );
      setStatus({ kind: 'idle' });
      return;
    }
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('delete', { id }, 'DELETE');
      setBenefits((prev) =>
        prev.filter((b) => b.id !== id).map((b, i) => ({ ...b, order: i })),
      );
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to delete',
      });
    }
  };

  const moveBenefit = (id: string, dir: -1 | 1) => {
    setBenefits((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next.map((b, i) => ({ ...b, order: i }));
    });
    setStatus({ kind: 'idle' });
  };

  const onSaveAll = async () => {
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('settings', { settings });

      const existingIds = new Set(initial.benefits.map((b) => b.id));
      for (const b of benefits) {
        if (b.title.trim().length === 0) continue;
        if (!existingIds.has(b.id)) {
          const result = await apiFetch('benefit', {
            benefit: { title: b.title, description: b.description, icon: b.icon },
          });
          const persisted = (result as { benefit?: BenefitItem }).benefit;
          if (persisted?.id) {
            setBenefits((prev) =>
              prev.map((x) => (x.id === b.id ? { ...x, id: persisted.id } : x)),
            );
          }
        } else {
          await apiFetch('benefit', {
            benefit: {
              id: b.id,
              title: b.title,
              description: b.description,
              icon: b.icon,
            },
          });
        }
      }

      const currentIds = new Set(benefits.map((b) => b.id));
      for (const old of initial.benefits) {
        if (!currentIds.has(old.id) && isPersistedBenefitId(old.id)) {
          await apiFetch('delete', { id: old.id }, 'DELETE');
        }
      }

      const finalIds = benefits
        .filter((b) => b.title.trim().length > 0)
        .map((b) => b.id);
      if (finalIds.length > 0) {
        await apiFetch('reorder', { ids: finalIds });
      }

      setStatus({ kind: 'saved', at: Date.now() });
      writeDraft(null);
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
    }
  };

  return (
    <div className="container-base section-padding">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-paprika">
            Admin
          </p>
          <h1 className="font-serif text-3xl font-bold text-hunter-green">
            Why Join Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit judul section dan kartu benefit yang tampil di home page
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveBadge status={status} />
          <button
            type="button"
            onClick={onSaveAll}
            disabled={status.kind === 'saving'}
            className="rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-paprika-hover disabled:opacity-50"
          >
            {status.kind === 'saving' ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </header>

      <section className="mb-8 rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-hunter-green">
          Heading
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Tag, judul, dan subjudul section
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Tag</span>
            <input
              type="text"
              value={settings.tag}
              onChange={(e) => setSettingsField('tag', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={FIELD_LABEL_CLS}>Title</span>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettingsField('title', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className={FIELD_LABEL_CLS}>Subtitle</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setSettingsField('subtitle', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Benefits
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Kartu benefit yang tampil di grid 3 kolom
            </p>
          </div>
          <button
            type="button"
            onClick={addBenefit}
            className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            <PlusIcon size={14} />
            Tambah benefit
          </button>
        </header>

        <ul className="mt-6 grid gap-3">
          {benefits.length === 0 && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Belum ada benefit. Klik "Tambah benefit" untuk mulai.
            </li>
          )}
          {benefits.map((benefit, idx) => {
            const PickerIcon =
              ICON_PICKER.find((p) => p.key === benefit.icon)?.Icon ?? UsersIcon;
            return (
              <li
                key={benefit.id}
                className="rounded-xl border border-light-gray bg-off-white p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="flex w-14 flex-shrink-0 flex-col items-center gap-1">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-hunter-green to-teal text-white">
                      <PickerIcon size={26} />
                    </div>
                    <span className="text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
                      #{idx + 1}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 min-w-0">
                    <input
                      type="text"
                      value={benefit.title}
                      onChange={(e) =>
                        updateBenefit(benefit.id, { title: e.target.value })
                      }
                      placeholder="Judul benefit"
                      className={INPUT_CLS}
                    />
                    <textarea
                      rows={2}
                      value={benefit.description}
                      onChange={(e) =>
                        updateBenefit(benefit.id, { description: e.target.value })
                      }
                      placeholder="Deskripsi singkat"
                      className={INPUT_CLS}
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray mr-1">
                        Icon:
                      </span>
                      {ICON_PICKER.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => updateBenefit(benefit.id, { icon: key })}
                          aria-pressed={benefit.icon === key}
                          aria-label={`Icon: ${label}`}
                          title={label}
                          className={
                            benefit.icon === key
                              ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg bg-hunter-green text-white shadow-sm transition-all'
                              : 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-light-gray bg-white text-graphite transition-all hover:border-hunter-green hover:text-hunter-green'
                          }
                        >
                          <Icon size={16} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveBenefit(benefit.id, -1)}
                      disabled={idx === 0}
                      aria-label="Move up"
                      className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                    >
                      <ChevronUp size={16} className="rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBenefit(benefit.id, 1)}
                      disabled={idx === benefits.length - 1}
                      aria-label="Move down"
                      className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
                    >
                      <ChevronUp size={16} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeBenefit(benefit.id)}
                    aria-label="Remove benefit"
                    className="rounded-md p-1.5 text-paprika transition-colors hover:bg-paprika/10"
                  >
                    <XIcon size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function SaveBadge({ status }: { status: SaveStatus }) {
  if (status.kind === 'idle') {
    return (
      <span className="text-xs text-dark-gray">Belum ada perubahan disimpan</span>
    );
  }
  if (status.kind === 'saving') {
    return <span className="text-xs text-dark-gray">Menyimpan...</span>;
  }
  if (status.kind === 'saved') {
    return (
      <span className="rounded-full bg-hunter-green/10 px-3 py-1 text-xs font-semibold text-hunter-green">
        Tersimpan
      </span>
    );
  }
  return (
    <span className="rounded-full bg-paprika/10 px-3 py-1 text-xs font-semibold text-paprika">
      {status.message}
    </span>
  );
}
