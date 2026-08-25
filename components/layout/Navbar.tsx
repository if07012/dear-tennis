'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LinkButton } from '@/components/ui/Button';
import { scrollToSection, throttle } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const NAV_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#why-join', label: 'Why Join' },
  { href: '/#activities', label: 'Activities' },
  { href: '/#events', label: 'Events' },
  { href: '/#gallery', label: 'Gallery' },
  { href: '/#testimonials', label: 'Stories' },
  { href: '/#faq', label: 'FAQ' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, hydrated, logout } = useAuth();

  // Scroll effect (throttled to once per 100ms)
  useEffect(() => {
    const handle = throttle(() => {
      setScrolled(window.scrollY > 100);
    }, 100);
    handle();
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  // Active section highlight via IntersectionObserver
  useEffect(() => {
    if (pathname !== '/') return;
    const sectionIds = ['about', 'why-join', 'activities', 'events', 'gallery', 'testimonials', 'faq'];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the highest intersection ratio
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-100px 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('/#')) return;
    if (pathname !== '/') return; // Let Link navigate to home + hash
    e.preventDefault();
    const id = href.replace('/#', '');
    setMenuOpen(false);
    scrollToSection(id);
  };

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    router.push('/');
  };

  return (
    <>
      <nav
        className={[
          'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-md'
            : 'bg-white/80 backdrop-blur-sm',
        ].join(' ')}
      >
        <div className="container-base flex items-center justify-between h-20">
          <Link href="/" className="font-serif text-2xl font-bold text-hunter-green tracking-tight">
            Dear Tennis
          </Link>

          <button
            type="button"
            className={[
              'md:hidden flex flex-col gap-1.5 p-2 z-50',
              menuOpen ? 'open' : '',
            ].join(' ')}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span
              className={[
                'w-6 h-0.5 bg-hunter-green transition-all duration-300 origin-center',
                menuOpen ? 'rotate-45 translate-y-2' : '',
              ].join(' ')}
            />
            <span
              className={[
                'w-6 h-0.5 bg-hunter-green transition-all duration-300',
                menuOpen ? 'opacity-0' : '',
              ].join(' ')}
            />
            <span
              className={[
                'w-6 h-0.5 bg-hunter-green transition-all duration-300 origin-center',
                menuOpen ? '-rotate-45 -translate-y-2' : '',
              ].join(' ')}
            />
          </button>

          <ul className="hidden md:flex items-center gap-8 list-none m-0 p-0">
            {NAV_LINKS.map((link) => {
              const id = link.href.replace('/#', '');
              const isActive = pathname === '/' && activeId === id;
              return (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => handleAnchorClick(e, link.href)}
                    className={[
                      'text-sm font-medium text-graphite hover:text-paprika transition-colors duration-200 relative',
                      'after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-0.5 after:bg-paprika after:transition-all after:duration-300',
                      'hover:after:w-full',
                      isActive ? 'text-paprika after:w-full' : '',
                    ].join(' ')}
                  >
                    {link.label}
                  </a>
                </li>
              );
            })}
            {hydrated && isAuthenticated ? (
              <>
                <li>
                  <Link
                    href="/profile"
                    className="text-sm font-medium text-graphite hover:text-paprika transition-colors"
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-sm font-medium text-graphite hover:text-paprika transition-colors"
                  >
                    Logout
                  </button>
                </li>
              </>
            ) : (
              hydrated && (
                <>
                  <li>
                    <LinkButton href="/#cta" size="sm">
                      Join Now
                    </LinkButton>
                  </li>
                  <li>
                    <Link
                      href="/login"
                      className="text-sm font-medium text-graphite hover:text-paprika transition-colors"
                    >
                      Login
                    </Link>
                  </li>
                </>
              )
            )}
          </ul>
        </div>
      </nav>

      {/* Mobile menu drawer */}
      <div
        className={[
          'fixed inset-0 z-30 md:hidden transition-opacity duration-300',
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        ].join(' ')}
      >
        <div
          className="absolute inset-0 bg-graphite/40 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
        <div
          className={[
            'absolute top-20 left-0 right-0 bg-white shadow-xl transition-transform duration-300',
            menuOpen ? 'translate-y-0' : '-translate-y-full',
          ].join(' ')}
        >
          <ul className="flex flex-col items-stretch py-6">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="block px-6 py-4 text-base font-medium text-graphite hover:bg-off-white hover:text-paprika transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
            {hydrated && isAuthenticated ? (
              <>
                <li className="px-6 pt-2 pb-4">
                  <Link
                    href="/profile"
                    className="block py-3 text-center bg-hunter-green text-white rounded-full font-medium hover:bg-hunter-green/90 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                </li>
                <li className="px-6 pb-6">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full py-3 text-center border-2 border-hunter-green text-hunter-green rounded-full font-medium hover:bg-hunter-green hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </li>
              </>
            ) : (
              hydrated && (
                <>
                  <li className="px-6 pt-2 pb-4">
                    <LinkButton href="/#cta" size="full">
                      Join Now
                    </LinkButton>
                  </li>
                  <li className="px-6 pb-6">
                    <Link
                      href="/login"
                      className="block py-3 text-center border-2 border-hunter-green text-hunter-green rounded-full font-medium hover:bg-hunter-green hover:text-white transition-colors"
                    >
                      Login
                    </Link>
                  </li>
                </>
              )
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
