import { Counter } from '@/components/ui/Counter';
import { statistics } from '@/data/statistics';

export function Statistics() {
  return (
    <section className="section-padding bg-hunter-green text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(135deg,#E85D04_0%,transparent_50%)]" />
      <div className="container-base relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {statistics.map((stat) => (
            <div key={stat.id}>
              <Counter
                value={stat.value}
                suffix={stat.suffix}
                className="block font-serif text-5xl md:text-6xl font-bold text-paprika mb-2"
              />
              <p className="text-sm md:text-base text-white/80 uppercase tracking-widest">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
