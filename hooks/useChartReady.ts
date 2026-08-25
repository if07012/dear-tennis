'use client';

import { useEffect, useState } from 'react';
import { getChart } from '@/lib/chart-ready';

// Mirrors the loose `ChartCtor` defined in lib/chart-ready.ts. We duplicate the
// shape here instead of exporting the type because that would re-introduce a
// `chart.js` import.
type ChartCtor = NonNullable<Window['Chart']>;

/**
 * Returns the global `window.Chart` constructor once Chart.js has loaded,
 * or `null` until then.
 */
export function useChartReady() {
  const [chartCtor, setChartCtor] = useState<ChartCtor | null>(null);

  useEffect(() => {
    let cancelled = false;
    getChart().then((C) => {
      // Chart is a function (class constructor). React treats a bare function
      // passed to setState as an updater, so wrap it: () => C stores C as state.
      if (!cancelled) setChartCtor(() => C);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return chartCtor;
}
