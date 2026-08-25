'use client';

import Script from 'next/script';
import { markChartLoaded } from '@/lib/chart-ready';

export function ChartScript() {
  return (
    <Script
      src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (window.Chart) {
          markChartLoaded(window.Chart as Parameters<typeof markChartLoaded>[0]);
        }
      }}
    />
  );
}
