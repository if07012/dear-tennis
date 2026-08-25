export type Benefit = {
  id: string;
  title: string;
  description: string;
  icon: 'users' | 'lightning' | 'calendar' | 'layers' | 'clock' | 'heart';
};

export const benefits: Benefit[] = [
  {
    id: 'community',
    title: 'Vibrant Community',
    description:
      'Connect with passionate players of all levels. Make friends, find playing partners, and be part of a supportive network.',
    icon: 'users',
  },
  {
    id: 'skill',
    title: 'Skill Development',
    description:
      'Access coaching sessions, drills, and workshops designed to elevate your game regardless of your current level.',
    icon: 'lightning',
  },
  {
    id: 'events',
    title: 'Regular Events',
    description:
      'From weekly social plays to monthly tournaments, there is always something exciting happening on our calendar.',
    icon: 'calendar',
  },
  {
    id: 'facilities',
    title: 'Premium Facilities',
    description:
      'Play at top-quality courts across the city with flexible booking options and member-exclusive access.',
    icon: 'layers',
  },
  {
    id: 'schedule',
    title: 'Flexible Schedule',
    description:
      'Morning, afternoon, or evening – we have options that fit your lifestyle and availability.',
    icon: 'clock',
  },
  {
    id: 'inclusive',
    title: 'Inclusive Environment',
    description:
      'All ages, all levels, all backgrounds welcome. We celebrate diversity and foster inclusivity.',
    icon: 'heart',
  },
];
