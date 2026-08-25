'use client';

import { useMemo, useState } from 'react';
import { Reveal } from '@/components/ui/Reveal';
import { profileUser, skillByEvent } from '@/data/profile';
import type { SkillKey } from '@/data/profile-types';
import { ProfileSidebar } from './ProfileSidebar';
import { AchievementsGrid } from './AchievementsGrid';
import { SkillBreakdown } from './SkillBreakdown';
import { EventFilterChips } from './EventFilterChips';
import { EventHistory } from './EventHistory';
import { EventGallery } from './EventGallery';
import { SkillOverviewChart } from './SkillOverviewChart';
import { PerformanceOverviewChart } from './PerformanceOverviewChart';

const SKILL_KEYS: SkillKey[] = ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'];

function summarize(
  selectedIds: string[],
): Partial<Record<SkillKey, number>> | null {
  if (selectedIds.length === 0) return null;
  const events = selectedIds
    .map((id) => skillByEvent[id])
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  if (events.length === 0) return null;

  const summary: Partial<Record<SkillKey, number>> = {};
  for (const key of SKILL_KEYS) {
    const values = events.map((e) => e[key]).filter((v): v is number => typeof v === 'number');
    if (values.length > 0) {
      summary[key] = Math.round(
        values.reduce((a, b) => a + b, 0) / values.length,
      );
    }
  }
  return summary;
}

export function ProfileLayout() {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const skillSummary = useMemo(() => summarize(selectedEvents), [selectedEvents]);

  return (
    <div className="container-base section-padding">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        <Reveal>
          <ProfileSidebar user={profileUser} />
        </Reveal>

        <main className="flex flex-col gap-8 min-w-0">
          <Reveal>
            <SkillOverviewChart />
          </Reveal>

          <Reveal>
            <PerformanceOverviewChart selectedEvents={selectedEvents} />
          </Reveal>

          <Reveal>
            <section className="bg-white rounded-2xl shadow-md p-6 lg:p-8">
              <header className="mb-6">
                <h2 className="font-serif text-2xl font-semibold text-hunter-green">
                  Filter & Breakdown
                </h2>
                <p className="text-sm text-dark-gray">
                  Pilih event untuk melihat rata-rata skill kamu
                </p>
              </header>
              <EventFilterChips
                selectedIds={selectedEvents}
                onChange={setSelectedEvents}
              />
              <div className="mt-6">
                <SkillBreakdown skillSummary={skillSummary} />
              </div>
            </section>
          </Reveal>

          <Reveal>
            <AchievementsGrid />
          </Reveal>

          <Reveal>
            <EventGallery />
          </Reveal>

          <Reveal>
            <EventHistory />
          </Reveal>
        </main>
      </div>
    </div>
  );
}