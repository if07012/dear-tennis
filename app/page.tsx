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
import { getWhyJoinContent } from '@/lib/why-join-store';
import { getActivitiesContent } from '@/lib/activities-store';
import { getCalendarContent } from '@/lib/calendar-store';
import { getGalleryContent } from '@/lib/gallery-store';
import { getTestimonialsContent } from '@/lib/testimonials-store';
import { getStatisticsContent } from '@/lib/statistics-store';
import { getFAQContent } from '@/lib/faq-store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [
    hero,
    ourStory,
    whyJoin,
    activities,
    calendar,
    galleryContent,
    testimonials,
    statistics,
    faq,
  ] = await Promise.all([
    getHeroContent(),
    getOurStoryContent(),
    getWhyJoinContent(),
    getActivitiesContent(),
    getCalendarContent(),
    getGalleryContent(),
    getTestimonialsContent(),
    getStatisticsContent(),
    getFAQContent(),
  ]);
  return (
    <>
      <Hero content={hero} />
      <About content={ourStory} />
      <WhyJoin settings={whyJoin.settings} benefits={whyJoin.benefits} />
      <Activities settings={activities.settings} activities={activities.activities} />
      <Gallery content={galleryContent} />
      <Testimonials content={testimonials} />
      <Statistics content={statistics} />
      <FAQ content={faq} />
      <CTA />
    </>
  );
}