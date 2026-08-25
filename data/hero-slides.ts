export type HeroSlide = {
  id: number;
  image: string;
  alt: string;
};

export const heroSlides: HeroSlide[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=3840&auto=format&fit=crop',
    alt: 'Tennis court at sunset',
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1652911588534-b36a1807bf6b?q=80&w=1310&auto=format&fit=crop',
    alt: 'Tennis player in action',
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1684443726764-6a236cb33ccb?q=80&w=3840&auto=format&fit=crop',
    alt: 'Tennis match moment',
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1684443726116-b8849430c6fe?q=80&w=1469&auto=format&fit=crop',
    alt: 'Tennis community gathering',
  },
];
