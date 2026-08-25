import { Reveal } from './Reveal';

type SectionHeaderProps = {
  tag?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  className?: string;
  id?: string;
};

/**
 * Reusable section header: tag → title → optional subtitle.
 * Mirrors the original `.section-tag` / `.section-title` / `.section-subtitle` structure.
 */
export function SectionHeader({ tag, title, subtitle, center, className, id }: SectionHeaderProps) {
  return (
    <div
      className={[
        'flex flex-col gap-3 mb-12',
        center ? 'items-center text-center' : 'items-start',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {tag ? (
        <Reveal direction="up">
          <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-paprika">
            {tag}
          </span>
        </Reveal>
      ) : null}
      <Reveal direction="up" delay={1}>
        <h2
          id={id}
          className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-hunter-green"
        >
          {title}
        </h2>
      </Reveal>
      {subtitle ? (
        <Reveal direction="up" delay={2}>
          <p className="max-w-2xl text-base md:text-lg text-dark-gray text-pretty">{subtitle}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
