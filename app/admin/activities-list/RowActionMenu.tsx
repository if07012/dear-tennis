'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVerticalIcon } from '@/components/ui/Icons';

type Item =
  | {
      kind?: 'item';
      key: string;
      label: string;
      onSelect: () => void;
      disabled?: boolean;
      destructive?: boolean;
    }
  | {
      kind: 'divider';
      key: string;
    };

type Props = {
  label: string;
  items: Item[];
};

/**
 * Single kebab button that opens a small popover of secondary row actions.
 * Used so the activity row doesn't have to carry one button per action.
 * Click-outside + Esc close the menu.
 */
export function RowActionMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-light-gray bg-white text-dark-gray transition-colors hover:border-dark-gray hover:text-graphite"
      >
        <MoreVerticalIcon size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-light-gray bg-white shadow-lg"
        >
          {items.map((it) =>
            it.kind === 'divider' ? (
              <div
                key={it.key}
                role="separator"
                className="my-1 h-px bg-light-gray"
              />
            ) : (
              <button
                key={it.key}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onSelect();
                }}
                className={[
                  'block w-full px-3 py-2 text-left text-xs font-semibold transition-colors',
                  it.destructive
                    ? 'text-paprika hover:bg-paprika/10'
                    : 'text-graphite hover:bg-off-white',
                  it.disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : '',
                ].join(' ')}
              >
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
