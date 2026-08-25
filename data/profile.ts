// ============================================
// PROFILE DATA
// ============================================
// Hard-coded data backing the player dashboard at /profile.
// All numbers mirror the static profile.html; ids are unified so the same
// slug can index into performanceByEvent, skillByEvent, and eventHistory.

import type {
  Achievement,
  ChipColor,
  FilterableEvent,
  PerformanceMetrics,
  ProfileUser,
  SkillBreakdownItem,
  SkillValues,
} from './profile-types';

export const profileUser: ProfileUser = {
  id: 'alex-johnson',
  name: 'Alex Johnson',
  rank: 'Advanced Player',
  avatarUrl:
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=400&h=400&fit=crop',
  stats: {
    sessions: 48,
    avgScore: 7.8,
    hours: 156,
    badges: 12,
  },
};

// ============================================
// SKILL OVERVIEW (radar chart)
// ============================================
export const skillRadar: { labels: Array<'Forehand' | 'Backhand' | 'Serve' | 'Volley' | 'Footwork' | 'Strategy'>; values: number[] } = {
  labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork', 'Strategy'],
  values: [85, 72, 68, 79, 91, 75],
};

// ============================================
// PERFORMANCE OVERVIEW (per event)
// ============================================
export const performanceByEvent: Record<string, PerformanceMetrics> = {
  'tournament-2024': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [88, 82, 78, 83, 92],
    kesalahan: [15, 20, 25, 16, 10],
  },
  'club-championship': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [90, 85, 80, 85, 95],
    kesalahan: [10, 16, 20, 12, 7],
  },
  'friendly-match': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [92, 88, 82, 87, 96],
    kesalahan: [8, 14, 18, 10, 5],
  },
  'summer-open': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [93, 89, 84, 88, 97],
    kesalahan: [7, 12, 16, 9, 4],
  },
  'winter-classic': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [85, 80, 75, 82, 90],
    kesalahan: [18, 22, 28, 19, 12],
  },
  'spring-showdown': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [87, 83, 77, 84, 91],
    kesalahan: [16, 21, 26, 17, 11],
  },
  'autumn-academy': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [86, 81, 76, 83, 89],
    kesalahan: [17, 23, 27, 18, 13],
  },
  'night-lights': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [84, 79, 74, 81, 88],
    kesalahan: [19, 24, 29, 20, 14],
  },
  'rookie-cup': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [80, 75, 70, 78, 85],
    kesalahan: [22, 28, 32, 23, 17],
  },
  'masters-series': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [91, 87, 83, 89, 94],
    kesalahan: [9, 15, 19, 11, 8],
  },
  'doubles-delight': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [89, 84, 79, 86, 93],
    kesalahan: [12, 18, 23, 14, 9],
  },
  'charity-challenge': {
    labels: ['Forehand', 'Backhand', 'Serve', 'Volley', 'Footwork'],
    target: [88, 83, 78, 85, 91],
    kesalahan: [14, 19, 24, 15, 10],
  },
};

// ============================================
// SKILL BY EVENT
// ============================================
// The static page only had 4 entries — extend to 12 so every chip has data.
export const skillByEvent: Record<string, SkillValues> = {
  'tournament-2024': { Forehand: 85, Backhand: 72, Serve: 68, Volley: 79, Footwork: 91 },
  'club-championship': { Forehand: 88, Backhand: 75, Serve: 71, Volley: 82, Footwork: 93 },
  'friendly-match': { Forehand: 90, Backhand: 78, Serve: 74, Volley: 85, Footwork: 95 },
  'summer-open': { Forehand: 92, Backhand: 80, Serve: 76, Volley: 87, Footwork: 96 },
  'winter-classic': { Forehand: 82, Backhand: 70, Serve: 66, Volley: 77, Footwork: 88 },
  'spring-showdown': { Forehand: 84, Backhand: 73, Serve: 68, Volley: 78, Footwork: 90 },
  'autumn-academy': { Forehand: 83, Backhand: 71, Serve: 67, Volley: 76, Footwork: 87 },
  'night-lights': { Forehand: 81, Backhand: 69, Serve: 65, Volley: 74, Footwork: 85 },
  'rookie-cup': { Forehand: 76, Backhand: 64, Serve: 60, Volley: 70, Footwork: 80 },
  'masters-series': { Forehand: 89, Backhand: 78, Serve: 73, Volley: 84, Footwork: 94 },
  'doubles-delight': { Forehand: 87, Backhand: 74, Serve: 70, Volley: 81, Footwork: 92 },
  'charity-challenge': { Forehand: 86, Backhand: 72, Serve: 69, Volley: 80, Footwork: 89 },
};

// ============================================
// SKILL BREAKDOWN (defaults; values recomputed from filter)
// ============================================
export const skillBreakdownDefaults: SkillBreakdownItem[] = [
  {
    skill: 'Forehand',
    level: 'Expert',
    description:
      'Konsistensi dan akurasi forehand sangat baik dengan kontrol bola yang matang.',
    gradient: 'from-emerald-400 to-emerald-600',
    details: [
      { label: 'Accuracy', value: 92 },
      { label: 'Power', value: 78 },
      { label: 'Consistency', value: 85 },
    ],
  },
  {
    skill: 'Backhand',
    level: 'Intermediate',
    description:
      'Backhand cukup solid namun perlu peningkatan dalam hal power dan konsistensi.',
    gradient: 'from-sky-400 to-sky-600',
    details: [
      { label: 'Accuracy', value: 75 },
      { label: 'Power', value: 65 },
      { label: 'Consistency', value: 76 },
    ],
  },
  {
    skill: 'Serve',
    level: 'Beginner',
    description:
      'Serve memerlukan perbaikan teknik dan konsistensi untuk meningkatkan efektivitas.',
    gradient: 'from-amber-400 to-orange-500',
    details: [
      { label: 'Accuracy', value: 70 },
      { label: 'Power', value: 62 },
      { label: 'Consistency', value: 72 },
    ],
  },
  {
    skill: 'Volley',
    level: 'Advanced',
    description: 'Volley menunjukkan kemampuan net play yang baik dengan refleks cepat.',
    gradient: 'from-pink-400 to-pink-600',
    details: [
      { label: 'Accuracy', value: 82 },
      { label: 'Power', value: 71 },
      { label: 'Consistency', value: 84 },
    ],
  },
  {
    skill: 'Footwork',
    level: 'Expert',
    description:
      'Footwork luar biasa dengan pergerakan cepat dan posisi yang tepat di lapangan.',
    gradient: 'from-purple-400 to-purple-600',
    details: [
      { label: 'Speed', value: 95 },
      { label: 'Agility', value: 88 },
      { label: 'Balance', value: 90 },
    ],
  },
];

// ============================================
// ACHIEVEMENTS
// ============================================
export const achievements: Achievement[] = [
  { id: 'champion', icon: '🏆', label: 'Champion' },
  { id: 'speedster', icon: '⚡', label: 'Speedster' },
  { id: 'accuracy', icon: '🎯', label: 'Accuracy' },
  { id: 'hot-streak', icon: '🔥', label: 'Hot Streak' },
  { id: 'power', icon: '💪', label: 'Power' },
  { id: 'all-star', icon: '🌟', label: 'All-Star' },
];

// ============================================
// EVENT HISTORY (10 entries; ids match perf/skill slugs)
// ============================================
const PHOTO_1 =
  'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop';
const PHOTO_2 =
  'https://images.unsplash.com/photo-1587683437362-da7775ffc532?q=80&w=800&auto=format&fit=crop';
const PHOTO_3 =
  'https://images.unsplash.com/photo-1756670777545-a4fde8f47cda?q=80&w=800&auto=format&fit=crop';
const PHOTO_4 =
  'https://images.unsplash.com/photo-1684443726764-6a236cb33ccb?q=80&w=800&auto=format&fit=crop';
const PHOTO_5 =
  'https://images.unsplash.com/photo-1661474974379-0f24bee86ce0?q=80&w=800&auto=format&fit=crop';

export const eventHistory: FilterableEvent[] = [
  {
    id: 'summer-open',
    title: 'Summer Open 2024',
    date: '2024-08-15',
    type: 'open',
    icon: '☀️',
    location: 'Jakarta Tennis Center',
    photos: [PHOTO_1, PHOTO_2],
  },
  {
    id: 'club-championship',
    title: 'Club Championship',
    date: '2024-07-20',
    type: 'championship',
    icon: '🎾',
    location: 'Senayan Sports Club',
    photos: [PHOTO_3, PHOTO_4, PHOTO_5],
  },
  {
    id: 'tournament-2024',
    title: 'Tournament 2024',
    date: '2024-06-10',
    type: 'tournament',
    icon: '🏆',
    location: 'Gelora Bung Karno',
    photos: [PHOTO_1],
  },
  {
    id: 'friendly-match',
    title: 'Fun Match Series - Multiple Matches',
    date: '2024-05-25',
    type: 'funmatch',
    icon: '🤝',
    location: 'Kemang Tennis Court',
    eventRank: 2,
    matches: [
      { score: '6-4, 3-6, 6-3', isDoubles: true, partners: ['Andi Wijaya', 'Budi Santoso'], opponent: 'Team A', result: 'win' },
      { score: '7-5, 6-2', isDoubles: false, partners: [], opponent: 'Carlos Mendez', result: 'win' },
      { score: '4-6, 6-3, 6-4', isDoubles: true, partners: ['Charlie Tan'], opponent: 'Team B', result: 'loss' },
    ],
    photos: [PHOTO_2, PHOTO_3],
  },
  {
    id: 'spring-showdown',
    title: 'Spring Showdown',
    date: '2024-04-18',
    type: 'open',
    icon: '🌸',
    location: 'PIK Tennis Arena',
    photos: [PHOTO_4],
  },
  {
    id: 'winter-classic',
    title: 'Winter Classic',
    date: '2024-03-05',
    type: 'tournament',
    icon: '❄️',
    location: 'BSD Tennis Center',
    photos: [PHOTO_5, PHOTO_1],
  },
  {
    id: 'autumn-academy',
    title: 'Training Session',
    date: '2024-02-14',
    type: 'training',
    icon: '🎯',
    location: 'Menteng Stadium',
    photos: [PHOTO_2],
  },
  {
    id: 'masters-series',
    title: 'Fun Match Night',
    date: '2024-01-20',
    type: 'funmatch',
    icon: '⭐',
    location: 'Ciputra Golf Club',
    eventRank: 1,
    matches: [
      { score: '7-5, 6-2', isDoubles: false, partners: [], opponent: 'David Lee', result: 'win' },
    ],
    photos: [PHOTO_3, PHOTO_4, PHOTO_5],
  },
  {
    id: 'rookie-cup',
    title: 'Advanced Training',
    date: '2024-01-10',
    type: 'training',
    icon: '💪',
    location: 'Senayan Sports Club',
    photos: [PHOTO_1],
  },
  {
    id: 'doubles-delight',
    title: 'Weekend Fun Match',
    date: '2023-12-15',
    type: 'funmatch',
    icon: '🎉',
    location: 'Jakarta Tennis Center',
    eventRank: 3,
    matches: [
      { score: '4-6, 6-3, 6-4', isDoubles: true, partners: ['Charlie Tan', 'David Lim'], opponent: 'Team X', result: 'win' },
      { score: '6-7, 6-4, 6-2', isDoubles: true, partners: ['Eko Prasetyo'], opponent: 'Team Y', result: 'loss' },
    ],
    photos: [PHOTO_2, PHOTO_3],
  },
];

// ============================================
// CHIP COLOR PALETTE
// ============================================
// Decorative colors used by the multi-select chip filter. Not part of the
// brand palette — kept here so the visual identity is preserved.
export const chipPalette: Record<string, ChipColor> = {
  'tournament-2024': { border: 'border-hunter-green', bg: 'bg-hunter-green/10', text: 'text-hunter-green' },
  'club-championship': { border: 'border-teal', bg: 'bg-teal/10', text: 'text-teal' },
  'friendly-match': { border: 'border-hunter-green', bg: 'bg-hunter-green/10', text: 'text-hunter-green' },
  'summer-open': { border: 'border-hunter-green-light', bg: 'bg-hunter-green-light/10', text: 'text-hunter-green-light' },
  'winter-classic': { border: 'border-[#6B5B95]', bg: 'bg-[#6B5B95]/10', text: 'text-[#6B5B95]' },
  'spring-showdown': { border: 'border-[#FF6B6B]', bg: 'bg-[#FF6B6B]/10', text: 'text-[#FF6B6B]' },
  'autumn-academy': { border: 'border-[#FFA500]', bg: 'bg-[#FFA500]/10', text: 'text-[#FFA500]' },
  'night-lights': { border: 'border-[#4ECDC4]', bg: 'bg-[#4ECDC4]/10', text: 'text-[#4ECDC4]' },
  'rookie-cup': { border: 'border-[#FFD93D]', bg: 'bg-[#FFD93D]/10', text: 'text-[#B8860B]' },
  'masters-series': { border: 'border-[#C44569]', bg: 'bg-[#C44569]/10', text: 'text-[#C44569]' },
  'doubles-delight': { border: 'border-[#575FCF]', bg: 'bg-[#575FCF]/10', text: 'text-[#575FCF]' },
  'charity-challenge': { border: 'border-[#00D2D3]', bg: 'bg-[#00D2D3]/10', text: 'text-[#00D2D3]' },
};

export const chipOrder: Array<keyof typeof chipPalette> = [
  'tournament-2024',
  'club-championship',
  'friendly-match',
  'summer-open',
  'winter-classic',
  'spring-showdown',
  'autumn-academy',
  'night-lights',
  'rookie-cup',
  'masters-series',
  'doubles-delight',
  'charity-challenge',
];

export const chipEmojis: Record<string, string> = {
  'tournament-2024': '🏆',
  'club-championship': '🎾',
  'friendly-match': '🤝',
  'summer-open': '☀️',
  'winter-classic': '❄️',
  'spring-showdown': '🌸',
  'autumn-academy': '🍂',
  'night-lights': '🌙',
  'rookie-cup': '🆕',
  'masters-series': '👑',
  'doubles-delight': '👥',
  'charity-challenge': '❤️',
};

export const chipLabels: Record<string, string> = {
  'tournament-2024': 'Tournament 2024',
  'club-championship': 'Club Championship',
  'friendly-match': 'Friendly Match',
  'summer-open': 'Summer Open',
  'winter-classic': 'Winter Classic',
  'spring-showdown': 'Spring Showdown',
  'autumn-academy': 'Autumn Academy',
  'night-lights': 'Night Lights',
  'rookie-cup': 'Rookie Cup',
  'masters-series': 'Masters Series',
  'doubles-delight': 'Doubles Delight',
  'charity-challenge': 'Charity Challenge',
};
