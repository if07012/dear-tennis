'use client';

// ============================================
// CLICK TRACKER
// ============================================
// Global click listener mounted once in the root layout. Captures clicks on
// a/button/[role="button"] via event delegation (capture phase, so
// stopPropagation in leaf handlers doesn't hide clicks), buffers up to 20
// events, and flushes every 30s / on page hide with fetch keepalive.
// Bot user-agents are filtered server-side (the request UA header).

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { TrackedClick } from '@/data/click-tracking-types';

const FLUSH_INTERVAL_MS = 30_000;
const MAX_BUFFER = 20;
const MAX_RETRY_BUFFER = 100;
const CLICKABLE_SELECTOR = 'a, button, [role="button"]';

type Props = { activityTitle?: string };

function buttonTextFor(el: HTMLElement): string {
  // Icon-only buttons (gallery arrows, burger menu) have empty innerText —
  // fall back through accessible names, then the href, then a generic label.
  return (
    (el.innerText ?? '').trim() ||
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.getAttribute('href') ||
    'Ikon'
  ).slice(0, 200);
}

export function ClickTracker({ activityTitle = '' }: Props): null {
  const { user } = useAuth();
  const bufferRef = useRef<TrackedClick[]>([]);
  const flushingRef = useRef(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return; // bots/drivers

    let cancelled = false;

    const flush = () => {
      if (flushingRef.current || cancelled) return;
      if (bufferRef.current.length === 0) return;
      const events = bufferRef.current.splice(0, bufferRef.current.length);
      flushingRef.current = true;
      fetch('/api/track/clicks', {
        method: 'POST',
        keepalive: true, // survives the page going away
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
      })
        .catch(() => {
          // Network failure — re-queue and let the next interval retry.
          bufferRef.current = [...events, ...bufferRef.current].slice(0, MAX_RETRY_BUFFER);
        })
        .finally(() => {
          flushingRef.current = false;
        });
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      const el = target.closest<HTMLElement>(CLICKABLE_SELECTOR);
      if (!el) return;

      let elementType: TrackedClick['elementType'] = 'other';
      if (el instanceof HTMLAnchorElement) elementType = 'a';
      else if (el instanceof HTMLButtonElement) elementType = 'button';

      bufferRef.current.push({
        buttonText: buttonTextFor(el),
        elementType,
        targetUrl: (el.getAttribute('href') ?? '').slice(0, 500),
        pageUrl: window.location.pathname.slice(0, 200),
        activityTitle,
        clickedAt: new Date().toISOString(), // UTC — lexicographically sortable
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        referrerUrl: document.referrer.slice(0, 200),
        userName: user?.name || undefined,
        userEmail: user?.email || undefined,
      });

      if (bufferRef.current.length >= MAX_BUFFER) flush();
    };

    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('click', onClick, true);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    const interval = window.setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      cancelled = true;
      flush(); // last chance before unmount
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      window.clearInterval(interval);
    };
  }, [user, activityTitle]);

  return null;
}
