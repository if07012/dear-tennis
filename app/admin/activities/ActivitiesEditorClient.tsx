'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type {
  ActivitiesContent,
  ActivitiesSettings,
} from '@/data/activities-types';

type SettingsDraft = Omit<ActivitiesSettings, 'id' | 'updatedAt'>;

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'admin.activities.heading.draft';

type Draft = { settings: SettingsDraft };

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

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';
export function ActivitiesEditorClient({ initial }: { initial: ActivitiesContent }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsDraft>({
    tag: initial.settings.tag,
    title: initial.settings.title,
    subtitle: initial.settings.subtitle,
  });
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = readDraft();
    if (d) setSettings(d.settings);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings });
  }, [hydrated, settings]);

  const apiFetch = useCallback(
    async (kind: 'settings', payload: Record<string, unknown>) => {
      const res = await fetch('/api/activities', {
        method: 'PUT',
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

  const setField = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setStatus({ kind: 'idle' });
  };

  const onSave = async () => {
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('settings', { settings });
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
            Activities Heading
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit tag, judul, dan subjudul section Activities di home page
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveBadge status={status} />
          <button
            type="button"
            onClick={onSave}
            disabled={status.kind === 'saving'}
            className="rounded-full bg-paprika px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-paprika-hover disabled:opacity-50"
          >
            {status.kind === 'saving' ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-hunter-green">
          Section heading
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Tag, judul, dan subjudul yang tampil di atas grid Activities pada home page
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Tag</span>
            <input
              type="text"
              value={settings.tag}
              onChange={(e) => setField('tag', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={FIELD_LABEL_CLS}>Title</span>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setField('title', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-3">
            <span className={FIELD_LABEL_CLS}>Subtitle</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setField('subtitle', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
        </div>

        <div className="mt-6 rounded-xl border border-light-gray bg-off-white p-4 text-sm text-dark-gray">
          <p>
            Kartu activity yang tampil di home page adalah{' '}
            <strong>6 teratas</strong> dari{' '}
            <Link
              href="/admin/activities-list"
              className="text-paprika underline-offset-2 hover:underline"
            >
              Activities List
            </Link>
            . Untuk menambah, menghapus, atau mengurutkan activity, buka halaman
            list.
          </p>
        </div>
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
