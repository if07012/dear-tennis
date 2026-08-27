'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LinkButton } from '@/components/ui/Button';
import { scrollToSection, throttle } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/admin';

const NAV_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#why-join', label: 'Why Join' },
  { href: '/#activities', label: 'Activities' },
  { href: '/#events', label: 'Events' },
  { href: '/#gallery', label: 'Gallery' },
  { href: '/#testimonials', label: 'Stories' },
  { href: '/#faq', label: 'FAQ' },
];

// Admin burger-menu items. The "Journey" entry maps to the Why-Join editor —
// the why-join section is the user-journey CTA on the home page.
const ADMIN_NAV_LINKS = [
  { href: '/admin/activities', label: 'Manage Activities' },
  { href: '/admin/activities-list', label: 'Activities List' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/gallery', label: 'Gallery' },
  { href: '/admin/hero', label: 'Hero' },
  { href: '/admin/our-story', label: 'Our Story' },
  { href: '/admin/testimonials', label: 'Testimonials' },
  { href: '/admin/statistics', label: 'Statistics' },
  { href: '/admin/faq', label: 'FAQ' },
  { href: '/admin/invite', label: 'Invite Members' },
  { href: '/admin/why-join', label: 'Journey' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, hydrated, logout } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  // Admin pages (and the logout page) get a stripped-down header: no public
  // nav links, just a burger that opens the admin section list. This keeps
  // editors focused on their work and works the same on desktop and mobile.
  const isAdminRoute = pathname?.startsWith('/admin') ?? false;
  const isLogoutRoute = pathname === '/logout';
  const isAdminMode = isAdminRoute || isLogoutRoute;

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
              // Always show the burger in admin mode (mobile + desktop); on
              // public pages keep the existing mobile-only behaviour.
              isAdminMode
                ? 'flex flex-col gap-1.5 p-2 z-50'
                : 'md:hidden flex flex-col gap-1.5 p-2 z-50',
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

          {isAdminMode ? (
            // Admin pages: hide the public nav links and auth buttons. The
            // burger button on the left above is the only entry point to the
            // admin drawer; the drawer body lists every admin section.
            <span className="sr-only" aria-live="polite">
              Admin menu
            </span>
          ) : (
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
                  {isAdmin && (
                    <li>
                      <Link
                        href="/admin/hero"
                        className="text-sm font-medium text-paprika hover:text-paprika-hover transition-colors"
                      >
                        Admin
                      </Link>
                    </li>
                  )}
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
          )}
        </div>
      </nav>

      {/* Menu drawer — public links on the home page, admin sections on admin pages. */}
      <div
        className={[
          'fixed inset-0 z-30 transition-opacity duration-300',
          // Public drawer is mobile-only (md:hidden); admin drawer covers both.
          isAdminMode ? '' : 'md:hidden',
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
          {isAdminMode ? (
            <ul className="flex flex-col items-stretch py-6">
              <li className="px-6 pb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-dark-gray">
                  Admin Sections
                </p>
              </li>
              {ADMIN_NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className={[
                        'block px-6 py-4 text-base font-medium transition-colors',
                        isActive
                          ? 'text-paprika bg-paprika/5 border-l-4 border-paprika'
                          : 'text-graphite hover:bg-off-white hover:text-paprika',
                      ].join(' ')}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
              {hydrated && isAuthenticated && (
                <li className="px-6 pt-4 border-t border-light-gray mt-4">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full py-3 text-center border-2 border-hunter-green text-hunter-green rounded-full font-medium hover:bg-hunter-green hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </li>
              )}
            </ul>
          ) : (
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
                  {isAdmin && (
                    <li className="px-6 pb-4">
                      <Link
                        href="/admin/hero"
                        onClick={() => setMenuOpen(false)}
                        className="block py-3 text-center border-2 border-paprika text-paprika rounded-full font-medium hover:bg-paprika hover:text-white transition-colors"
                      >
                        Admin Panel
                      </Link>
                    </li>
                  )}
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
          )}
        </div>
      </div>
    </>
  );
}
