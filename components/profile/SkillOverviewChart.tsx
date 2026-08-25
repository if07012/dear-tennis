'use client';

import { useEffect, useRef } from 'react';
import { useChartReady } from '@/hooks/useChartReady';
import { skillRadar } from '@/data/profile';
import { BarChartIcon } from '@/components/ui/Icons';

// Loose shape that mirrors Chart.js's public surface; we deliberately avoid
// importing the `chart.js` package types since the runtime comes from CDN.
type ChartHandle = { destroy(): void; update(): void };
type ChartCtor = new (ctx: HTMLCanvasElement, config: unknown) => ChartHandle;

export function SkillOverviewChart() {
  const Chart = useChartReady() as ChartCtor | null;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartHandle | null>(null);

  useEffect(() => {
    if (!Chart || !canvasRef.current) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'radar',
      data: {
        labels: skillRadar.labels,
        datasets: [
          {
            label: 'Skill Level',
            data: skillRadar.values,
            backgroundColor: 'rgba(44, 95, 75, 0.2)',
            borderColor: 'rgba(44, 95, 75, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(232, 93, 4, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(232, 93, 4, 1)',
            pointRadius: 5,
            pointHoverRadius: 7,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(58, 58, 58, 0.95)',
            titleFont: { family: 'Inter', size: 13, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 10,
            cornerRadius: 6,
            displayColors: false,
            callbacks: {
              label: (ctx: { parsed: { r: number } }) =>
                `${ctx.parsed.r}/100`,
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              backdropColor: 'transparent',
              color: '#6c757d',
              font: { size: 10 },
            },
            grid: { color: 'rgba(173, 181, 189, 0.3)' },
            angleLines: { color: 'rgba(173, 181, 189, 0.3)' },
            pointLabels: {
              color: '#3A3A3A',
              font: { family: 'Inter', size: 12, weight: '600' },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [Chart]);

  return (
    <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
      <header className="mb-6 flex items-center gap-3">
        <span className="profile-section-icon" aria-hidden="true">
          <BarChartIcon />
        </span>
        <div>
          <h2 className="font-serif text-2xl font-semibold text-hunter-green">
            Skill Overview
          </h2>
          <p className="text-sm text-dark-gray">
            Radar chart kemampuan kamu secara keseluruhan
          </p>
        </div>
      </header>

      <div className="relative h-[340px] w-full">
        {Chart ? (
          <canvas ref={canvasRef} aria-label="Skill overview radar chart" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-dark-gray">
            Memuat chart...
          </div>
        )}
      </div>
    </section>
  );
}