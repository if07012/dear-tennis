import { HeroSlider } from './HeroSlider';
import type { HeroContent } from '@/data/hero-types';

type Props = {
  content: HeroContent;
};

export function Hero({ content }: Props) {
  return <HeroSlider content={content} />;
}
