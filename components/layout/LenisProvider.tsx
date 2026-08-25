'use client';

import type { ReactNode } from 'react';

type LenisProviderProps = {
  children: ReactNode;
};

/**
 * Optional smooth-scroll provider. Native scrolling is used by default so wheel/trackpad
 * input stays instant. Anchor links still smooth-scroll via CSS `scroll-behavior: smooth`
 * in app/globals.css and `scrollToSection()` in lib/utils.ts.
 *
 * To re-enable Lenis inertia scrolling, install @studio-freight/lenis and wire it here.
 */
export function LenisProvider({ children }: LenisProviderProps) {
  return <>{children}</>;
}
