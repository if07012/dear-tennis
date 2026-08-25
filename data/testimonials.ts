export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  since: string;
  avatar: string;
};

export const testimonials: Testimonial[] = [
  {
    id: 'sarah-chen',
    quote:
      "Joining Dear Tennis was the best decision I've made. The community is so welcoming, and I've improved my game more in six months than in years of playing alone. The coaches are incredible and the friendships I've made are priceless.",
    name: 'Sarah Chen',
    since: 'Member since 2021',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop',
  },
  {
    id: 'marcus-johnson',
    quote:
      "What I love most is the variety. Whether I want a serious training session or just a casual hit with friends, there's always something happening. The ladder league keeps me motivated and the social events are so much fun.",
    name: 'Marcus Johnson',
    since: 'Member since 2022',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
  },
  {
    id: 'emma-rodriguez',
    quote:
      "As someone who started tennis late in life, I was nervous about joining a club. Dear Tennis made me feel at home from day one. Everyone is patient, encouraging, and genuinely passionate about the sport. It's more than a club — it's family.",
    name: 'Emma Rodriguez',
    since: 'Member since 2020',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&auto=format&fit=crop',
  },
];
