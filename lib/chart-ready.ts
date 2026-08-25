// ============================================
// CHART.JS READY PROMISE
// ============================================
// Chart.js is loaded via <ChartScript> in app/profile/. This module exposes
// a single shared promise that resolves once `window.Chart` is defined, so
// every chart component can `await` it without each one installing its own
// script.

// We don't import the `chart.js` types package — Chart.js ships only as a
// UMD global from the CDN, and the type-only import here would force a
// runtime dep we deliberately avoid. Instead, we treat `window.Chart` as a
// loose constructor type. Consumers that want stricter typing should cast.

type ChartCtor = new (
  ctx: HTMLCanvasElement,
  config: unknown,
) => { destroy(): void; update(): void };

declare global {
  interface Window {
    Chart?: ChartCtor;
  }
}

let resolver: ((chart: ChartCtor) => void) | null = null;
const promise = new Promise<ChartCtor>((resolve) => {
  resolver = resolve;
});

let resolved = false;

export function getChart(): Promise<ChartCtor> {
  if (typeof window === 'undefined') {
    // Never resolves on the server — keeps callers safe under SSR.
    return new Promise(() => {});
  }
  if (window.Chart) {
    if (!resolved) {
      resolved = true;
      resolver?.(window.Chart);
    }
    return promise;
  }
  return promise;
}

export function markChartLoaded(chart: ChartCtor) {
  if (resolved) return;
  resolved = true;
  resolver?.(chart);
}
