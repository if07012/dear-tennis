export type FAQ = {
  id: string;
  question: string;
  answer: string;
};

export const faqs: FAQ[] = [
  {
    id: 'become-member',
    question: 'How do I become a member?',
    answer:
      "Simply fill out the membership form on our homepage or contact us directly. We'll set up a free trial session so you can experience our community before committing. Most members are up and playing within a week of signing up.",
  },
  {
    id: 'equipment',
    question: 'Do I need my own equipment?',
    answer:
      "Not at all! We have demo rackets available for beginners and shared balls at every session. Once you decide tennis is for you, our coaches can help you choose the right equipment for your level and budget.",
  },
  {
    id: 'beginner',
    question: "What if I'm a complete beginner?",
    answer:
      "Perfect — most of our members started as beginners. We offer dedicated beginner sessions every week, patient coaches, and a supportive community that remembers what it was like to start. You'll be rallying in no time.",
  },
  {
    id: 'guests',
    question: 'Can I bring guests?',
    answer:
      "Absolutely! Members can bring up to two guests per month to any of our social events. It's a great way to introduce friends to the sport and the community. Just let us know in advance so we can plan accordingly.",
  },
  {
    id: 'cancellation',
    question: "What's the cancellation policy?",
    answer:
      "Monthly memberships can be cancelled at any time with 30 days notice. For events and workshops, we offer full refunds up to 48 hours before the start time. We understand life happens — just communicate with us and we'll work it out.",
  },
];
