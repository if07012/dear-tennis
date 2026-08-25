'use client';

import { useState, type FormEvent } from 'react';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/Button';
import { showNotification } from '@/components/ui/Notification';
import { ArrowRight } from '@/components/ui/Icons';

type FormState = {
  name: string;
  email: string;
  level: string;
};

const INITIAL: FormState = { name: '', email: '', level: '' };

export function CTA() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.level) {
      showNotification('Please fill in all fields', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      showNotification('Please enter a valid email address', 'error');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      showNotification(
        `Thank you ${form.name}! We'll contact you at ${form.email} within 24 hours.`,
        'success',
      );
      setForm(INITIAL);
      setSubmitting(false);
    }, 1500);
  };

  return (
    <section
      id="cta"
      className="section-padding relative overflow-hidden bg-gradient-to-br from-hunter-green via-hunter-green-dark to-hunter-green text-white"
    >
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-paprika/40 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-teal/40 blur-3xl" />
      </div>

      <div className="container-base max-w-3xl text-center relative">
        <Reveal direction="scale">
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-8 md:p-12 border border-white/10">
            <span className="inline-block text-xs font-semibold tracking-[0.2em] uppercase text-paprika mb-3">
              Join Us
            </span>
            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-semibold text-white mb-4">
              Ready to Join the Family?
            </h2>
            <p className="text-white/80 max-w-xl mx-auto mb-10 text-pretty">
              Sign up today and start your tennis journey. We will reach out within 24 hours to
              welcome you to the community.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  required
                  className="w-full px-5 py-3.5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:border-paprika focus:bg-white/15 transition-colors"
                />
              </div>
              <div>
                <input
                  type="email"
                  placeholder="Email Address"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                  className="w-full px-5 py-3.5 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/60 focus:outline-none focus:border-paprika focus:bg-white/15 transition-colors"
                />
              </div>
              <div>
                <select
                  value={form.level}
                  onChange={(e) => update('level', e.target.value)}
                  required
                  className={[
                    'w-full px-5 py-3.5 rounded-full bg-white/10 border border-white/20 focus:outline-none focus:border-paprika focus:bg-white/15 transition-colors',
                    form.level ? 'text-white' : 'text-white/60',
                  ].join(' ')}
                >
                  <option value="" disabled>
                    Playing Level
                  </option>
                  <option value="beginner" className="text-graphite">
                    Beginner
                  </option>
                  <option value="intermediate" className="text-graphite">
                    Intermediate
                  </option>
                  <option value="advanced" className="text-graphite">
                    Advanced
                  </option>
                </select>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="full"
                disabled={submitting}
                className="mt-2"
              >
                {submitting ? 'Submitting...' : 'Get Started Free'}
                {!submitting && <ArrowRight size={16} />}
              </Button>
            </form>
            <p className="text-sm text-white/60 mt-4">
              No commitment required. We&apos;ll reach out within 24 hours.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
