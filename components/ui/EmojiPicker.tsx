'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

// Curated emoji catalog grouped by category. Sourced from Unicode's
// emoji-data so the project doesn't depend on an external API or a CDN
// at runtime. Keep the list short and useful for badges.

const CATEGORIES: ReadonlyArray<{ label: string; emojis: readonly string[] }> = [
  {
    label: 'Trophy',
    emojis: [
      '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '👑', '💎', '🌟', '⭐',
    ],
  },
  {
    label: 'Sport',
    emojis: [
      '🎾', '🏸', '🏓', '🏐', '⚽', '🏀', '🥎', '🎯', '🥍', '🏒',
    ],
  },
  {
    label: 'Fire',
    emojis: [
      '🔥', '💥', '⚡', '🚀', '💪', '🦾', '🎯', '🏹', '🥊', '🤺',
    ],
  },
  {
    label: 'Streak',
    emojis: [
      '📈', '📊', '🏁', '🎽', '🎖', '🏵', '🌠', '🌋', '🏔', '🗻',
    ],
  },
  {
    label: 'Star',
    emojis: [
      '🌟', '⭐', '✨', '💫', '🎇', '🎆', '🏆', '🥇', '🌠', '💖',
    ],
  },
  {
    label: 'Misc',
    emojis: [
      '🏆', '🎖', '👑', '💎', '🥇', '🏅', '🎗', '🥳', '🙌', '👏',
    ],
  },
];

const ALL_EMOJIS = CATEGORIES.flatMap((c) => c.emojis);

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    // Filter the master list by keyword matches against category labels
    // and a hard-coded keyword map. We don't have per-emoji names here,
    // so this is a coarse filter; good enough for v1.
    const keywordMap: Record<string, string[]> = {
      '🏆': ['trophy', 'champion', 'winner'],
      '🥇': ['gold', 'first', 'champion'],
      '🥈': ['silver', 'second'],
      '🥉': ['bronze', 'third'],
      '🏅': ['medal', 'badge'],
      '🎖': ['medal', 'military'],
      '👑': ['crown', 'king', 'queen', 'leader'],
      '💎': ['gem', 'diamond', 'premium'],
      '🌟': ['star', 'shine'],
      '⭐': ['star'],
      '🔥': ['fire', 'hot', 'streak'],
      '💥': ['boom', 'explosion'],
      '⚡': ['lightning', 'speed', 'fast'],
      '🚀': ['rocket', 'launch', 'fast'],
      '💪': ['strong', 'muscle', 'power'],
      '🎯': ['target', 'accuracy', 'goal'],
      '🎾': ['tennis', 'ball'],
      '🏓': ['ping pong', 'table tennis'],
      '📈': ['growth', 'rising', 'improvement'],
      '📊': ['chart', 'stats'],
      '🏁': ['finish', 'flag'],
      '✨': ['sparkle', 'shine'],
      '💫': ['dizzy', 'star'],
      '🥳': ['celebrate', 'party'],
      '🙌': ['celebrate', 'hands'],
      '👏': ['clap', 'applause'],
    };
    return ALL_EMOJIS.filter((e) =>
      (keywordMap[e] ?? []).some((k) => k.toLowerCase().includes(q)),
    );
  }, [search]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-md border border-light-gray bg-off-white px-2 py-1 text-base transition-colors hover:border-hunter-green"
      >
        <span aria-hidden="true">{value || '🏅'}</span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-dark-gray">
          {open ? 'Close' : 'Pick'}
        </span>
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Emoji picker"
          className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-light-gray bg-white p-2 shadow-xl"
        >
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari (fire, star, tennis…)"
            className="mb-2 w-full rounded-md border border-light-gray bg-off-white px-2 py-1 text-xs focus:border-hunter-green focus:bg-white focus:outline-none"
            autoFocus
          />
          {filtered ? (
            filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-dark-gray">
                Tidak ada emoji cocok.
              </p>
            ) : (
              <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto">
                {filtered.map((e) => (
                  <EmojiButton
                    key={e}
                    emoji={e}
                    onClick={() => {
                      onChange(e);
                      setOpen(false);
                      setSearch('');
                    }}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {CATEGORIES.map((cat) => (
                <div key={cat.label}>
                  <p className="px-1 text-[0.6rem] font-semibold uppercase tracking-wider text-dark-gray">
                    {cat.label}
                  </p>
                  <div className="mt-1 grid grid-cols-8 gap-1">
                    {cat.emojis.map((e) => (
                      <EmojiButton
                        key={e}
                        emoji={e}
                        onClick={() => {
                          onChange(e);
                          setOpen(false);
                          setSearch('');
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmojiButton({
  emoji,
  onClick,
}: {
  emoji: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-lg transition-colors hover:bg-hunter-green/10"
      aria-label={emoji}
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}