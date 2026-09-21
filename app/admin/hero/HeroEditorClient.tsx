'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { HeroContent, HeroSettings, HeroSlideData } from '@/data/hero-types';
import { AdminTableToolbar } from '@/components/admin/AdminTableToolbar';
import { ResponsiveTable } from '@/components/admin/ResponsiveTable';
import { ResponsivePagination } from '@/components/admin/ResponsivePagination';
import { MobileActionMenu } from '@/components/admin/MobileActionMenu';
import { ChevronUp, PlusIcon } from '@/components/ui/Icons';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'admin.hero.draft';

type SettingsDraft = Omit<HeroSettings, 'id' | 'updatedAt'>;

type DraftItem = HeroSlideData & { order: number };

type Draft = { settings: SettingsDraft; items: DraftItem[] };

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

function isPersistedId(id: string) {
  if (id.startsWith('draft-')) return false;
  return id.length > 24;
}

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS = 'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

type InitialPage = HeroContent;

export function HeroEditorClient({ initial }: { initial: InitialPage }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsDraft>({
    title: initial.settings.title,
    subtitle: initial.settings.subtitle,
    description: initial.settings.description,
    ctaPrimaryLabel: initial.settings.ctaPrimaryLabel,
    ctaPrimaryHref: initial.settings.ctaPrimaryHref,
    ctaSecondaryLabel: initial.settings.ctaSecondaryLabel,
    ctaSecondaryHref: initial.settings.ctaSecondaryHref,
  });
  const [slides, setSlides] = useState<DraftItem[]>(
    initial.slides.map((s, i) => ({ ...s, order: i })),
  );
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [search, setSearch] = useState('');

  // Hydrate from local draft once
  useEffect(() => {
    const draft = readDraft();
    if (draft && Array.isArray(draft.items)) {
      setSettings(draft.settings);
      setSlides(draft.items);
    }
    setHydrated(true);
  }, []);

  // Persist a draft on every change
  useEffect(() => {
    if (!hydrated) return;
    writeDraft({ settings, items: slides });
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

  const setSettingsField = <K extends keyof SettingsDraft>(
    key: K,
    value: SettingsDraft[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setStatus({ kind: 'idle' });
  };

  const addSlide = () => {
    setSlides((prev) => {
      const next = [
        ...prev,
        {
          id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          image: '',
          alt: '',
          order: prev.length,
        },
      ];
      return next;
    });
    setStatus({ kind: 'idle' });
  };

  const updateSlide = (id: string, patch: { image: string; alt: string }) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
    setStatus({ kind: 'idle' });
  };

  const removeSlide = async (id: string) => {
    const target = slides.find((s) => s.id === id);
    if (!target) return;
    const persisted = isPersistedId(id);
    if (persisted) {
      setStatus({ kind: 'saving' });
      try {
        await apiFetch('delete', { id });
        setSlides((prev) =>
          prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, order: idx })),
        );
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

  const moveSlide = (id: string, dir: -1 | 1) => {
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

      // 2. Upsert each slide
      const existingIds = new Set(initial.slides.map((s) => s.id));
      for (const slide of slides) {
        if (slide.image.trim().length === 0) continue;
        if (!existingIds.has(slide.id)) {
          // create
          const result = await apiFetch('slide', {
            slide: { image: slide.image, alt: slide.alt },
          });
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
        if (!currentIds.has(old.id) && isPersistedId(old.id)) {
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

  const filteredSlides = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...slides].sort((a, b) => a.order - b.order);
    return [...slides].sort((a, b) => a.order - b.order).filter(
      (s) => s.image.toLowerCase().includes(q) || s.alt.toLowerCase().includes(q)
    );
  }, [slides, search]);

  const pageStart = (page - 1) * pageSize;
  const pageItems = useMemo(
    () => filteredSlides.slice(pageStart, pageStart + pageSize),
    [filteredSlides, pageStart, pageSize],
  );
  const totalPages = Math.max(1, Math.ceil(filteredSlides.length / pageSize));

  const changePageSize = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  const slideColumns = useMemo(() => [
    {
      key: 'number',
      header: '#',
      priority: 1 as const,
      className: 'w-12',
      render: (item: DraftItem) => {
        const idx = filteredSlides.findIndex((s) => s.id === item.id);
        return (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paprika/10 font-serif text-base font-bold text-paprika">
            #{idx + 1}
          </div>
        );
      },
    },
    {
      key: 'preview',
      header: 'Preview',
      priority: 1 as const,
      className: 'w-16',
      render: (item: DraftItem) => (
        <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-light-gray">
          {item.image ? (
            <img
              src={item.image}
              alt={item.alt || `Slide ${item.order + 1}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[0.6rem] font-bold uppercase tracking-wider text-dark-gray">
              No image
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'image',
      header: 'Image URL',
      priority: 1 as const,
      render: (item: DraftItem) => (
        <input
          type="url"
          value={item.image}
          onChange={(e) => updateSlide(item.id, { image: e.target.value, alt: item.alt })}
          placeholder="https://images.unsplash.com/..."
          className={INPUT_CLS}
        />
      ),
    },
    {
      key: 'alt',
      header: 'Alt text',
      priority: 2 as const,
      render: (item: DraftItem) => (
        <input
          type="text"
          value={item.alt}
          onChange={(e) => updateSlide(item.id, { image: item.image, alt: e.target.value })}
          placeholder="Alt text (describe the photo)"
          className={INPUT_CLS}
        />
      ),
    },
  ], [filteredSlides, updateSlide]);

  const getSlideRowActions = (item: DraftItem) => [
    {
      label: 'Naikkan',
      primary: false,
      disabled: () => filteredSlides.findIndex((s) => s.id === item.id) === 0,
      onClick: () => moveSlide(item.id, -1),
    },
    {
      label: 'Turunkan',
      primary: false,
      disabled: () => filteredSlides.findIndex((s) => s.id === item.id) === filteredSlides.length - 1,
      onClick: () => moveSlide(item.id, 1),
    },
    {
      label: 'Hapus',
      primary: false,
      destructive: true,
      onClick: () => removeSlide(item.id),
    },
  ];

  return (
    <div className="container-base section-padding">
      <header className="admin-header">
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
        <div className="flex flex-wrap items-center gap-3">
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
          Copy
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Teks utama yang tampil di hero section
        </p>

        <div className="mt-6 admin-form-grid">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Title (line 1)</span>
            <input
              type="text"
              value={settings.title}
              onChange={(e) => setSettingsField('title', e.target.value)}
              className={INPUT_CLS}
              placeholder="More Than Just a Game."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Subtitle (line 2, paprika)</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => setSettingsField('subtitle', e.target.value)}
              className={INPUT_CLS}
              placeholder="It's a Community."
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <span className={FIELD_LABEL_CLS}>Description</span>
            <textarea
              rows={3}
              value={settings.description}
              onChange={(e) => setSettingsField('description', e.target.value)}
              className={INPUT_CLS}
              placeholder="Where passion meets connection..."
            />
          </label>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-light-gray bg-white p-6">
        <h2 className="font-serif text-xl font-semibold text-hunter-green">
          Call-to-action buttons
        </h2>
        <p className="mt-1 text-sm text-dark-gray">
          Dua tombol di bawah deskripsi
        </p>

        <div className="mt-6 admin-form-grid">
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Primary label</span>
            <input
              type="text"
              value={settings.ctaPrimaryLabel}
              onChange={(e) => setSettingsField('ctaPrimaryLabel', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Primary href</span>
            <input
              type="text"
              value={settings.ctaPrimaryHref}
              onChange={(e) => setSettingsField('ctaPrimaryHref', e.target.value)}
              className={INPUT_CLS}
              placeholder="/#cta"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Secondary label</span>
            <input
              type="text"
              value={settings.ctaSecondaryLabel}
              onChange={(e) => setSettingsField('ctaSecondaryLabel', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Secondary href</span>
            <input
              type="text"
              value={settings.ctaSecondaryHref}
              onChange={(e) => setSettingsField('ctaSecondaryHref', e.target.value)}
              className={INPUT_CLS}
              placeholder="/#about"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <AdminTableToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Cari image URL / alt text"
          onAdd={addSlide}
          addLabel="Tambah slide"
          loading={false}
        />

        <ResponsiveTable<DraftItem>
          items={pageItems}
          rowKey={(i) => i.id}
          columns={slideColumns}
          actions={getSlideRowActions}
          emptyMessage={slides.length === 0 ? 'Belum ada slide. Klik "Tambah slide" untuk mulai.' : 'Tidak ada hasil untuk pencarian ini.'}
          loading={false}
          mobileCardRender={(item) => {
            const idx = filteredSlides.findIndex((s) => s.id === item.id);
            return (
              <>
                <div className="admin-card-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-light-gray">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.alt || `Slide ${item.order + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[0.6rem] font-bold uppercase tracking-wider text-dark-gray">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-hunter-green truncate">{item.alt || 'Slide belum diisi'}</h3>
                      <p className="text-xs text-dark-gray">#{idx + 1}</p>
                    </div>
                  </div>
                </div>
                <div className="admin-card-body space-y-3">
                  <div className="admin-card-row flex flex-col items-start gap-1">
                    <span className="admin-card-label">Image URL</span>
                    <input
                      type="url"
                      value={item.image}
                      onChange={(e) => updateSlide(item.id, { image: e.target.value, alt: item.alt })}
                      placeholder="https://images.unsplash.com/..."
                      className={INPUT_CLS}
                    />
                  </div>
                  <div className="admin-card-row flex flex-col items-start gap-1">
                    <span className="admin-card-label">Alt text</span>
                    <input
                      type="text"
                      value={item.alt}
                      onChange={(e) => updateSlide(item.id, { image: item.image, alt: e.target.value })}
                      placeholder="Alt text (describe the photo)"
                      className={INPUT_CLS}
                    />
                  </div>
                </div>
                <div className="admin-card-actions">
                  <button
                    type="button"
                    onClick={() => moveSlide(item.id, -1)}
                    disabled={filteredSlides.findIndex((s) => s.id === item.id) === 0}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    Naikkan
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSlide(item.id, 1)}
                    disabled={filteredSlides.findIndex((s) => s.id === item.id) === filteredSlides.length - 1}
                    className="admin-card-action-primary admin-touch-target"
                  >
                    Turunkan
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlide(item.id)}
                    className="admin-card-action-primary admin-card-action-destructive admin-touch-target"
                  >
                    Hapus
                  </button>
                </div>
              </>
            );
          }}
        />

        <ResponsivePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </section>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={() => apiFetch('settings', { settings }).then(() => setStatus({ kind: 'saved', at: Date.now() }))}
          disabled={status.kind === 'saving'}
          className="text-xs font-semibold uppercase tracking-wider text-hunter-green transition-colors hover:text-paprika"
        >
          Simpan hanya copy
        </button>
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => {
            const finalIds = slides
              .filter((s) => s.image.trim().length > 0)
              .map((s) => s.id);
            if (finalIds.length > 0) {
              apiFetch('reorder', { ids: finalIds }).then(() => setStatus({ kind: 'saved', at: Date.now() }));
            }
          }}
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
