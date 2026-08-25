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
import { getHeroContent } from '@/lib/hero-store';
import { getOurStoryContent } from '@/lib/our-story-store';

export default async function Home() {
  const [hero, ourStory] = await Promise.all([
    getHeroContent(),
    getOurStoryContent(),
  ]);
  return (
    <>
      <Hero content={hero} />
      <About content={ourStory} />
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
