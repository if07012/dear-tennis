'use client';

import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, XIcon } from '@/components/ui/Icons';

type Props = {
  open: boolean;
  photos: string[];
  index: number;
  title?: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Portal-mounted lightbox with Escape-to-close, arrow-key nav, and body-scroll lock.
 * Reusable across galleries.
 */
export function Lightbox({
  open,
  photos,
  index,
  title,
  onClose,
  onPrev,
  onNext,
}: Props) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      }
    },
    [open, onClose, onPrev, onNext],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = original;
    };
  }, [open, handleKey]);

  if (typeof document === 'undefined') return null;

  const current = photos[index];

  return createPortal(
    <AnimatePresence>
      {open && current ? (
        <motion.div
          key="lightbox-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title ?? 'Photo viewer'}
        >
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <XIcon size={24} />
          </motion.button>

          {photos.length > 1 && (
            <>
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev();
                }}
                aria-label="Previous photo"
                className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <ChevronLeft size={28} />
              </motion.button>
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNext();
                }}
                aria-label="Next photo"
                className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                <ChevronRight size={28} />
              </motion.button>
            </>
          )}

          <motion.img
            key={current}
            src={current}
            alt={title ?? ''}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />

          {title && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur">
              {title}
              {photos.length > 1 && (
                <span className="ml-2 text-xs text-white/70">
                  {index + 1} / {photos.length}
                </span>
              )}
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}