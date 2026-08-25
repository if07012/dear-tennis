export type ActivityCategory = 'training' | 'social' | 'competitive';

export type Activity = {
  id: string;
  category: ActivityCategory;
  title: string;
  description: string;
  image: string;
  duration: string;
  groupSize: string;
};

export const activities: Activity[] = [
  {
    id: 'group-coaching',
    category: 'training',
    title: 'Group Coaching',
    description:
      'Learn from experienced coaches in small groups. Perfect your technique with personalized feedback in a supportive environment.',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop',
    duration: '90 min',
    groupSize: '4-6 players',
  },
  {
    id: 'casual-meetups',
    category: 'social',
    title: 'Casual Meetups',
    description:
      'Relaxed games for players of all levels. Make new friends while enjoying a few sets on the court.',
    image: 'https://images.unsplash.com/photo-1587683437362-da7775ffc532?q=80&w=800&auto=format&fit=crop',
    duration: '2 hours',
    groupSize: '8-12 players',
  },
  {
    id: 'monthly-tournaments',
    category: 'competitive',
    title: 'Monthly Tournaments',
    description:
      'Test your skills in our friendly monthly competitions. Prizes, glory, and bragging rights await.',
    image: 'https://images.unsplash.com/photo-1684443726764-6a236cb33ccb?q=80&w=800&auto=format&fit=crop',
    duration: 'All day',
    groupSize: '16-32 players',
  },
  {
    id: 'technique-workshops',
    category: 'training',
    title: 'Technique Workshops',
    description:
      'Deep-dive sessions on specific skills: serves, volleys, footwork, and strategy. Take your game to the next level.',
    image: 'https://images.unsplash.com/photo-1756670777545-a4fde8f47cda?q=80&w=800&auto=format&fit=crop',
    duration: '2 hours',
    groupSize: '6-10 players',
  },
  {
    id: 'community-gatherings',
    category: 'social',
    title: 'Community Gatherings',
    description:
      'Off-court social events, dinners, and meetups. Build friendships that extend beyond tennis.',
    image: 'https://images.unsplash.com/photo-1779539213887-f6461cdc1db5?q=80&w=800&auto=format&fit=crop',
    duration: '3 hours',
    groupSize: '20-50 people',
  },
  {
    id: 'ladder-league',
    category: 'competitive',
    title: 'Ladder League',
    description:
      'Compete weekly to climb the rankings. Challenge opponents at your level and earn your spot at the top.',
    image: 'https://images.unsplash.com/photo-1620589513121-5df7ed86e1c5b?q=80&w=800&auto=format&fit=crop',
    duration: 'Weekly',
    groupSize: 'Open',
  },
];
