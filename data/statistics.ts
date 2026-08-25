export type Statistic = {
  id: string;
  value: number;
  label: string;
  suffix?: string;
};

export const statistics: Statistic[] = [
  { id: 'members', value: 500, label: 'Active Members' },
  { id: 'matches', value: 1200, label: 'Matches Played' },
  { id: 'events', value: 150, label: 'Events Hosted' },
  { id: 'satisfaction', value: 98, label: '% Satisfaction', suffix: '%' },
];
