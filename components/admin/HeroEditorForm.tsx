'use client';

import { SlideRow } from './SlideRow';
import { ChevronUp, PlusIcon } from '@/components/ui/Icons';
import type { HeroSettings, HeroSlideData } from '@/data/hero-types';

type SettingsDraft = Pick<
  HeroSettings,
  | 'title'
  | 'subtitle'
  | 'description'
  | 'ctaPrimaryLabel'
  | 'ctaPrimaryHref'
  | 'ctaSecondaryLabel'
  | 'ctaSecondaryHref'
>;

type Props = {
  settings: SettingsDraft;
  slides: HeroSlideData[];
  onSettingsChange: (next: SettingsDraft) => void;
  onSlideAdd: () => void;
  onSlideUpdate: (id: string, patch: { image: string; alt: string }) => void;
  onSlideRemove: (id: string) => void;
  onSlideMove: (id: string, dir: -1 | 1) => void;
};

const FIELD_LABEL_CLS = 'text-xs font-semibold uppercase tracking-wider text-dark-gray';
const INPUT_CLS =
  'w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none';

export function HeroEditorForm({
  settings,
  slides,
  onSettingsChange,
  onSlideAdd,
  onSlideUpdate,
  onSlideRemove,
  onSlideMove,
}: Props) {
  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-light-gray bg-white p-6">
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
              onChange={(e) => set('title', e.target.value)}
              className={INPUT_CLS}
              placeholder="More Than Just a Game."
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Subtitle (line 2, paprika)</span>
            <input
              type="text"
              value={settings.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              className={INPUT_CLS}
              placeholder="It's a Community."
            />
          </label>

          <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <span className={FIELD_LABEL_CLS}>Description</span>
            <textarea
              rows={3}
              value={settings.description}
              onChange={(e) => set('description', e.target.value)}
              className={INPUT_CLS}
              placeholder="Where passion meets connection..."
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
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
              onChange={(e) => set('ctaPrimaryLabel', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Primary href</span>
            <input
              type="text"
              value={settings.ctaPrimaryHref}
              onChange={(e) => set('ctaPrimaryHref', e.target.value)}
              className={INPUT_CLS}
              placeholder="/#cta"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Secondary label</span>
            <input
              type="text"
              value={settings.ctaSecondaryLabel}
              onChange={(e) => set('ctaSecondaryLabel', e.target.value)}
              className={INPUT_CLS}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={FIELD_LABEL_CLS}>Secondary href</span>
            <input
              type="text"
              value={settings.ctaSecondaryHref}
              onChange={(e) => set('ctaSecondaryHref', e.target.value)}
              className={INPUT_CLS}
              placeholder="/#about"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-light-gray bg-white p-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-hunter-green">
              Slides
            </h2>
            <p className="mt-1 text-sm text-dark-gray">
              Gambar background yang tampil di carousel
            </p>
          </div>
          <button
            type="button"
            onClick={onSlideAdd}
            className="inline-flex items-center gap-1.5 rounded-full border border-hunter-green px-3 py-1.5 text-xs font-semibold text-hunter-green transition-colors hover:bg-hunter-green hover:text-white"
          >
            <PlusIcon size={14} />
            Tambah slide
          </button>
        </header>

        <ul className="mt-6 flex flex-col gap-3">
          {slides.length === 0 && (
            <li className="rounded-xl border border-dashed border-light-gray bg-off-white p-6 text-center text-sm text-dark-gray">
              Belum ada slide. Klik "Tambah slide" untuk mulai.
            </li>
          )}
          {slides.map((slide, idx) => (
            <SlideRow
              key={slide.id}
              slide={slide}
              index={idx}
              total={slides.length}
              onUpdate={(patch) => onSlideUpdate(slide.id, patch)}
              onRemove={() => onSlideRemove(slide.id)}
              onMoveUp={() => onSlideMove(slide.id, -1)}
              onMoveDown={() => onSlideMove(slide.id, 1)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
