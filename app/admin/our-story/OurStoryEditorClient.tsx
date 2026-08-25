'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { OurStorySettings } from '@/data/our-story-types';

type Draft = Omit<OurStorySettings, 'id' | 'updatedAt'>;

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; message: string };

const DRAFT_KEY = 'admin.our-story.draft';

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

export function OurStoryEditorClient({ initial }: { initial: OurStorySettings }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<Draft>({
    tag: initial.tag,
    title: initial.title,
    subtitle: initial.subtitle,
    lead: initial.lead,
    body: initial.body,
    closing: initial.closing,
    image: initial.image,
    imageAlt: initial.imageAlt,
  });
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = readDraft();
    if (d) setDraft(d);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeDraft(draft);
  }, [hydrated, draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setStatus({ kind: 'idle' });
  };

  const onSave = async () => {
    setStatus({ kind: 'saving' });
    try {
      const res = await fetch('/api/our-story', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-auth-email': user?.email ?? '',
        },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
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
            Our Story Editor
          </h1>
          <p className="mt-1 text-sm text-dark-gray">
            Edit judul, paragraf, dan foto bagian About di halaman utama
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/hero"
            className="text-xs font-semibold uppercase tracking-wider text-dark-gray transition-colors hover:text-paprika"
          >
            ← Hero Editor
          </Link>
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

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-light-gray bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Heading
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Teks di atas judul utama About section
            </p>

            <div className="mt-6 grid gap-4">
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Tag (small uppercase label)</span>
                <input
                  type="text"
                  value={draft.tag}
                  onChange={(e) => set('tag', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Our Story"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Title</span>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => set('title', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Built on Love for the Game"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Subtitle (optional)</span>
                <input
                  type="text"
                  value={draft.subtitle}
                  onChange={(e) => set('subtitle', e.target.value)}
                  className={INPUT_CLS}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-light-gray bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Body text
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Tiga paragraf yang tampil di sisi kiri section
            </p>

            <div className="mt-6 grid gap-4">
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Lead (paragraf utama, larger)</span>
                <textarea
                  rows={3}
                  value={draft.lead}
                  onChange={(e) => set('lead', e.target.value)}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Body (paragraf kedua)</span>
                <textarea
                  rows={4}
                  value={draft.body}
                  onChange={(e) => set('body', e.target.value)}
                  className={INPUT_CLS}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Closing (paragraf penutup)</span>
                <textarea
                  rows={3}
                  value={draft.closing}
                  onChange={(e) => set('closing', e.target.value)}
                  className={INPUT_CLS}
                />
              </label>
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-light-gray bg-white p-6">
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Image
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Foto yang tampil di sisi kanan section
            </p>

            <div className="mt-6 overflow-hidden rounded-xl border border-light-gray bg-off-white">
              <div className="relative aspect-[4/5] w-full">
                {draft.image ? (
                  <Image
                    src={draft.image}
                    alt={draft.imageAlt || 'Our Story image preview'}
                    fill
                    sizes="(max-width: 1024px) 100vw, 360px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-dark-gray">
                    No image
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Image URL</span>
                <input
                  type="url"
                  value={draft.image}
                  onChange={(e) => set('image', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="https://images.unsplash.com/..."
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={FIELD_LABEL_CLS}>Image alt</span>
                <input
                  type="text"
                  value={draft.imageAlt}
                  onChange={(e) => set('imageAlt', e.target.value)}
                  className={INPUT_CLS}
                />
              </label>
            </div>
          </section>
        </aside>
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
