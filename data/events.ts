export type EventItem = {
  id: string;
  day: string;
  month: string;
  title: string;
  description: string;
  location: string;
  time: string;
  cta: string;
};

export const events: EventItem[] = [
  {
    id: 'new-year-kickoff',
    day: '15',
    month: 'JAN',
    title: 'New Year Kickoff Tournament',
    description:
      'Start the year with our flagship tournament. Open to all levels with categories for every skill.',
    location: 'Central Park Courts',
    time: '9:00 AM – 5:00 PM',
    cta: 'Register Now',
  },
  {
    id: 'beginners-workshop',
    day: '22',
    month: 'JAN',
    title: "Beginner's Workshop Series",
    description:
      'Four-week intensive covering the fundamentals: grip, stance, swing, and basic strategy.',
    location: 'Riverside Academy',
    time: '2:00 PM – 4:00 PM',
    cta: 'Reserve Spot',
  },
  {
    id: 'social-mixer',
    day: '28',
    month: 'JAN',
    title: 'Social Mixer Night',
    description:
      'Casual games followed by drinks and food. The perfect way to meet new playing partners.',
    location: 'Downtown Club',
    time: '6:00 PM – 9:00 PM',
    cta: 'RSVP',
  },
  {
    id: 'advanced-strategy',
    day: '04',
    month: 'FEB',
    title: 'Advanced Strategy Clinic',
    description:
      'High-level tactics and match play analysis. For experienced players looking to sharpen their game.',
    location: 'Pro Tennis Center',
    time: '10:00 AM – 1:00 PM',
    cta: 'Sign Up',
  },
];
