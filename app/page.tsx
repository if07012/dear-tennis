import { Hero } from '@/components/sections/Hero';
import { About } from '@/components/sections/About';
import { WhyJoin } from '@/components/sections/WhyJoin';
import { Activities } from '@/components/sections/Activities';
import { Events } from '@/components/sections/Events';
import { Gallery } from '@/components/sections/Gallery';
import { Testimonials } from '@/components/sections/Testimonials';
import { Statistics } from '@/components/sections/Statistics';
import { FAQ } from '@/components/sections/FAQ';
import { CTA } from '@/components/sections/CTA';

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <WhyJoin />
      <Activities />
      <Events />
      <Gallery />
      <Testimonials />
      <Statistics />
      <FAQ />
      <CTA />
    </>
  );
}
