export type GalleryItem = {
  id: string;
  src: string;
  alt: string;
  large?: boolean;
};

export const gallery: GalleryItem[] = [
  {
    id: 'match-point',
    src: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=800&auto=format&fit=crop',
    alt: 'Match point moment',
    large: true,
  },
  {
    id: 'team-photo',
    src: 'https://images.unsplash.com/photo-1587683437362-da7775ffc532?q=80&w=800&auto=format&fit=crop',
    alt: 'Team photo',
  },
  {
    id: 'training-session',
    src: 'https://images.unsplash.com/photo-1756670777545-a4fde8f47cda?q=80&w=800&auto=format&fit=crop',
    alt: 'Training session',
  },
  {
    id: 'event-celebration',
    src: 'https://images.unsplash.com/photo-1684443726764-6a236cb33ccb?q=80&w=800&auto=format&fit=crop',
    alt: 'Event celebration',
  },
  {
    id: 'trophy-moment',
    src: 'https://images.unsplash.com/photo-1661474974379-0f24bee86ce0?q=80&w=800&auto=format&fit=crop',
    alt: 'Trophy moment',
    large: true,
  },
  {
    id: 'sunset-play',
    src: 'https://images.unsplash.com/photo-1684443726116-b8849430c6fe?q=80&w=800&auto=format&fit=crop',
    alt: 'Sunset play',
  },
];
