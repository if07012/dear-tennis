// ============================================
// PROFILE DATA TYPES
// ============================================
// Source of truth for the player dashboard at /profile.

export type EventType = 'tournament' | 'championship' | 'open' | 'funmatch' | 'training';

export type MatchResult = 'win' | 'loss' | 'draw';

export type SkillKey = 'Forehand' | 'Backhand' | 'Serve' | 'Volley' | 'Footwork';

export type SkillAxis = SkillKey | 'Strategy';

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';

export type FunmatchMatch = {
  score: string;
  isDoubles: boolean;
  partners: string[];
  opponent: string;
  result: MatchResult;
};

export type FilterableEvent = {
  /** Slug used as the key in `performanceByEvent` and `skillByEvent`. */
  id: string;
  title: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  type: EventType;
  /** Admin "Edit activity" category. Mirrors `ActivityCategory` so the
   *  profile filter can stay in sync with the catalog without remapping. */
  category?: 'training' | 'social' | 'competitive';
  /** Emoji used in the date tile / gallery card. */
  icon: string;
  location: string;
  /** Free-form duration copied from the activity catalog (e.g. "90 min", "2 hours"). */
  duration?: string;
  photos: string[];
  /** Optional short blurb shown under the title. */
  description?: string;
  /** Only on funmatch-style events. */
  eventRank?: number;
  /** Only on funmatch-style events. */
  matches?: FunmatchMatch[];
};

export type SkillValues = Record<SkillKey, number>;

export type PerformanceMetrics = {
  labels: SkillKey[];
  target: number[];
  kesalahan: number[];
};

export type SkillDetailStat = {
  label: string;
  /** 0–100 percent. */
  value: number;
};

export type SkillBreakdownItem = {
  skill: SkillKey;
  /** Computed level (may be overridden by selected events at render time). */
  level: SkillLevel;
  description: string;
  /** Tailwind gradient classes for the fill bar, e.g. `from-emerald-400 to-emerald-600`. */
  gradient: string;
  /** Per-skill mini-stats shown in the expand panel. */
  details: SkillDetailStat[];
};

export type ChipColor = {
  border: string;
  /** Tailwind class for the active background, e.g. `bg-hunter-green/10`. */
  bg: string;
  /** Tailwind class for the active text color. */
  text: string;
  /** Accent color for the icon (e.g. "🏆" emoji) when active. */
  iconClass?: string;
};

export type ProfileUser = {
  id: string;
  name: string;
  rank: string;
  avatarUrl: string;
  stats: {
    sessions: number;
    avgScore: number;
    hours: number;
    badges: number;
  };
};

export type Achievement = {
  id: string;
  icon: string;
  label: string;
};
