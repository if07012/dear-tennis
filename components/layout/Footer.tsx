import Link from 'next/link';
import {
  FacebookIcon,
  InstagramIcon,
  TwitterIcon,
  YoutubeIcon,
  TennisBallIcon,
} from '@/components/ui/Icons';

const QUICK_LINKS = [
  { href: '/#about', label: 'About Us' },
  { href: '/#activities', label: 'Activities' },
  { href: '/#events', label: 'Events' },
  { href: '/#testimonials', label: 'Stories' },
  { href: '/#faq', label: 'FAQ' },
];

const PROGRAMS = [
  { href: '#', label: 'Group Coaching' },
  { href: '#', label: 'Private Lessons' },
  { href: '#', label: 'Junior Program' },
  { href: '#', label: 'Corporate Events' },
  { href: '#', label: 'Tournaments' },
];

export function Footer() {
  return (
    <footer className="bg-hunter-green-dark text-white">
      <div className="container-base py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TennisBallIcon size={28} className="text-paprika" />
              <span className="font-serif text-2xl font-bold">Dear Tennis</span>
            </div>
            <p className="text-white/80 leading-relaxed mb-6 text-pretty">
              More than just a tennis club — we are a community of passionate players, coaches, and
              friends who love the game.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                aria-label="Facebook"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-paprika transition-colors"
              >
                <FacebookIcon />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-paprika transition-colors"
              >
                <InstagramIcon />
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-paprika transition-colors"
              >
                <TwitterIcon />
              </a>
              <a
                href="#"
                aria-label="YouTube"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-paprika transition-colors"
              >
                <YoutubeIcon />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/80 hover:text-paprika transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-serif text-lg font-semibold mb-4">Programs</h3>
            <ul className="space-y-3">
              {PROGRAMS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/80 hover:text-paprika transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/60">
          <p>&copy; 2024 Dear Tennis. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
