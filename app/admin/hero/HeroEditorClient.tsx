'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { HeroEditorForm } from '@/components/admin/HeroEditorForm';
import type { HeroContent, HeroSettings, HeroSlideData } from '@/data/hero-types';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'admin.hero.draft';

type Draft = {
  settings: Omit<HeroSettings, 'id' | 'updatedAt'>;
  slides: HeroSlideData[];
};

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

export function HeroEditorClient({ initial }: { initial: HeroContent }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Draft['settings']>({
    title: initial.settings.title,
    subtitle: initial.settings.subtitle,
    description: initial.settings.description,
    ctaPrimaryLabel: initial.settings.ctaPrimaryLabel,
    ctaPrimaryHref: initial.settings.ctaPrimaryHref,
    ctaSecondaryLabel: initial.settings.ctaSecondaryLabel,
    ctaSecondaryHref: initial.settings.ctaSecondaryHref,
  });
  const [slides, setSlides] = useState<HeroSlideData[]>(initial.slides);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from local draft once (so a half-finished edit survives reloads).
  useEffect(() => {
    const draft = readDraft();
    if (draft) {
      setSettings(draft.settings);
      setSlides(draft.slides);
    }
    setHydrated(true);
  }, []);

  // Persist a draft on every change so the editor survives reloads.
  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings, slides });
  }, [hydrated, settings, slides]);

  const apiFetch = useCallback(
    async (kind: 'settings' | 'slide' | 'reorder' | 'delete', payload: Record<string, unknown>) => {
      const res = await fetch('/api/hero', {
        method: kind === 'delete' ? 'DELETE' : 'PUT',
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

  const persistSettings = useCallback(async () => {
    setStatus({ kind: 'saving' });
    try {
      await apiFetch('settings', { settings });
      setStatus({ kind: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Failed to save settings',
      });
    }
  }, [apiFetch, settings]);

  const persistSlideOrder = useCallback(
    async (next: HeroSlideData[]) => {
      const orderedIds = next.map((s) => s.id);
      setStatus({ kind: 'saving' });
      try {
        await apiFetch('reorder', { ids: orderedIds });
        setStatus({ kind: 'saved', at: Date.now() });
      } catch (e) {
        setStatus({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to reorder',
        });
      }
    },
    [apiFetch],
  );

  const onSettingsChange = (next: Draft['settings']) => {
    setSettings(next);
    setStatus({ kind: 'idle' });
  };

  const onSlideAdd = () => {
    setSlides((prev) => [
      ...prev,
      {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        image: '',
        alt: '',
        order: prev.length,
      },
    ]);
    setStatus({ kind: 'idle' });
  };

  const onSlideUpdate = (id: string, patch: { image: string; alt: string }) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    setStatus({ kind: 'idle' });
  };

  const onSlideRemove = async (id: string) => {
    const target = slides.find((s) => s.id === id);
    if (!target) return;
    // If the slide was already persisted (UUID-shaped), call DELETE.
    const isPersisted = id.length > 24; // UUIDs are 36 chars
    if (isPersisted) {
      setStatus({ kind: 'saving' });
      try {
        await apiFetch('delete', { id });
        const next = slides
          .filter((s) => s.id !== id)
          .map((s, idx) => ({ ...s, order: idx }));
        setSlides(next);
        setStatus({ kind: 'saved', at: Date.now() });
      } catch (e) {
        setStatus({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Failed to delete',
        });
      }
    } else {
      setSlides((prev) =>
        prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, order: idx })),
      );
      setStatus({ kind: 'idle' });
    }
  };

  const onSlideMove = (id: string, dir: -1 | 1) => {
    setSlides((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return next.map((s, i) => ({ ...s, order: i }));
    });
    setStatus({ kind: 'idle' });
  };

  const onSaveAll = async () => {
    setStatus({ kind: 'saving' });
    try {
      // 1. Settings
      await apiFetch('settings', { settings });

      // 2. Upsert each slide (draft-* ids become new rows; existing ids update)
      const existingIds = new Set(initial.slides.map((s) => s.id));
      for (const slide of slides) {
        if (slide.image.trim().length === 0) continue;
        if (!existingIds.has(slide.id)) {
          // create
          const result = await apiFetch('slide', {
            slide: { image: slide.image, alt: slide.alt },
          });
          // Replace draft id with the persisted id from the server.
          const persisted = (result as { slide?: HeroSlideData }).slide;
          if (persisted?.id) {
            setSlides((prev) =>
              prev.map((s) => (s.id === slide.id ? { ...s, id: persisted.id } : s)),
            );
          }
        } else {
          await apiFetch('slide', {
            slide: { id: slide.id, image: slide.image, alt: slide.alt },
          });
        }
      }

      // 3. Delete slides that existed initially but no longer do
      const currentIds = new Set(slides.map((s) => s.id));
      for (const old of initial.slides) {
        if (!currentIds.has(old.id) && old.id.length > 24) {
          await apiFetch('delete', { id: old.id });
        }
      }

      // 4. Persist order
      const finalIds = slides
        .filter((s) => s.image.trim().length > 0)
        .map((s) => s.id);
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
            Hero Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit judul, deskripsi, tombol CTA, dan slide background
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/our-story"
            className="text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika"
          >
            Our Story
          </Link>
          <span className="text-xs text-dark-gray">·</span>
          <Link
            href="/admin/why-join"
            className="text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika"
          >
            Why Join
          </Link>
          <span className="text-xs text-dark-gray">·</span>
          <Link
            href="/admin/calendar"
            className="text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika"
          >
            Calendar
          </Link>
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

      <HeroEditorForm
        settings={settings}
        slides={slides}
        onSettingsChange={onSettingsChange}
        onSlideAdd={onSlideAdd}
        onSlideUpdate={onSlideUpdate}
        onSlideRemove={onSlideRemove}
        onSlideMove={onSlideMove}
      />

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={persistSettings}
          disabled={status.kind === 'saving'}
          className="text-xs font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:text-paprika"
        >
          Simpan hanya copy
        </button>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => persistSlideOrder(slides)}
          disabled={status.kind === 'saving'}
          className="text-xs font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:text-paprika"
        >
          Simpan hanya urutan slide
        </button>
      </div>
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
