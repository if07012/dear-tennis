'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useChartReady } from '@/hooks/useChartReady';
import { performanceByEvent } from '@/data/profile';
import { LineChartIcon } from '@/components/ui/Icons';

type ChartHandle = { destroy(): void; update(): void };
type ChartCtor = new (ctx: HTMLCanvasElement, config: unknown) => ChartHandle;

type Props = {
  /** Selected event slugs. If empty, no chart shows. */
  selectedEvents: string[];
};

function aggregateMetrics(
  selectedIds: string[],
): { labels: string[]; target: number[]; kesalahan: number[] } | null {
  if (selectedIds.length === 0) return null;
  const metrics = selectedIds
    .map((id) => performanceByEvent[id])
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  if (metrics.length === 0) return null;

  const labels = metrics[0].labels;
  const target = labels.map((_, idx) =>
    Math.round(
      metrics.reduce((acc, m) => acc + m.target[idx], 0) / metrics.length,
    ),
  );
  const kesalahan = labels.map((_, idx) =>
    Math.round(
      metrics.reduce((acc, m) => acc + m.kesalahan[idx], 0) / metrics.length,
    ),
  );
  return { labels, target, kesalahan };
}

export function PerformanceOverviewChart({ selectedEvents }: Props) {
  const Chart = useChartReady() as ChartCtor | null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartHandle | null>(null);

  const aggregated = useMemo(() => aggregateMetrics(selectedEvents), [selectedEvents]);

  useEffect(() => {
    if (!Chart || !canvasRef.current || !aggregated) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: aggregated.labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Target',
            data: aggregated.target,
            backgroundColor: 'rgba(44, 95, 75, 0.7)',
            borderColor: 'rgba(44, 95, 75, 1)',
            borderWidth: 1,
            borderRadius: 6,
            order: 2,
          },
          {
            type: 'line' as const,
            label: 'Trend',
            data: aggregated.target,
            borderColor: 'rgba(232, 93, 4, 1)',
            backgroundColor: 'rgba(232, 93, 4, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 5,
            pointBackgroundColor: 'rgba(232, 93, 4, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 7,
            fill: false,
            order: 1,
          },
          {
            type: 'bar' as const,
            label: 'Kesalahan',
            data: aggregated.kesalahan,
            backgroundColor: 'rgba(232, 93, 4, 0.25)',
            borderColor: 'rgba(232, 93, 4, 0.7)',
            borderWidth: 1,
            borderRadius: 6,
            order: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Inter', size: 12 },
              color: '#3A3A3A',
              usePointStyle: true,
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(58, 58, 58, 0.95)',
            titleFont: { family: 'Inter', size: 13, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 6,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#6c757d' },
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(173, 181, 189, 0.3)' },
            ticks: { font: { family: 'Inter', size: 11 }, color: '#6c757d' },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [Chart, aggregated]);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="profile-section-icon" aria-hidden="true">
          <LineChartIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            Performance Overview
          </h2>
          <p className="text-sm text-dark-gray">
            Rata-rata performa per skill pada event yang dipilih
          </p>
        </div>
      </header>

      {selectedEvents.length === 0 ? (
        <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-light-gray bg-off-white text-sm text-dark-gray">
          Pilih minimal satu event di filter untuk menampilkan chart
        </div>
      ) : (
        <div className="relative h-[320px] w-full">
          {Chart && aggregated ? (
            <canvas
              ref={canvasRef}
              aria-label="Performance overview chart"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-dark-gray">
              Memuat chart...
            </div>
          )}
        </div>
      )}
    </section>
  );
}