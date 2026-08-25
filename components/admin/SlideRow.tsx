'use client';

import Image from 'next/image';
import { ChevronUp, XIcon } from '@/components/ui/Icons';
import type { HeroSlideData } from '@/data/hero-types';

type Props = {
  slide: HeroSlideData;
  index: number;
  total: number;
  onUpdate: (next: { image: string; alt: string }) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

export function SlideRow({ slide, index, total, onUpdate, onRemove, onMoveUp, onMoveDown }: Props) {
  return (
    <li className="rounded-xl border border-light-gray bg-off-white p-4">
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-light-gray bg-white">
          {slide.image ? (
            <Image
              src={slide.image}
              alt={slide.alt || `Slide ${index + 1}`}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-dark-gray">
              No image
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <input
            type="url"
            value={slide.image}
            onChange={(e) => onUpdate({ image: e.target.value, alt: slide.alt })}
            placeholder="https://images.unsplash.com/..."
            className="w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none"
          />
          <input
            type="text"
            value={slide.alt}
            onChange={(e) => onUpdate({ image: slide.image, alt: e.target.value })}
            placeholder="Alt text (describe the photo)"
            className="w-full rounded-lg border border-light-gray bg-white px-3 py-2 text-sm focus:border-hunter-green focus:outline-none"
          />
        </div>

        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label="Move up"
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
          >
            <ChevronUp size={16} className="rotate-180" />
          </button>
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-dark-gray">
            #{index + 1}
          </span>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label="Move down"
            className="rounded-md p-1.5 text-dark-gray transition-colors hover:bg-hunter-green/10 hover:text-hunter-green disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-dark-gray"
          >
            <ChevronUp size={16} />
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove slide"
          className="rounded-md p-1.5 text-paprika transition-colors hover:bg-paprika/10"
        >
          <XIcon size={18} />
        </button>
      </div>
    </li>
  );
}
