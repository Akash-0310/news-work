import { useEffect, useState } from 'react';
import { Menu, Search, X } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/utils/cn';
import { CategoryRail } from './CategoryRail';
import { Logo } from './Logo';

/**
 * Primary navigation.
 *
 * Only sections that actually exist are listed. Search, bookmarks and profile arrive
 * with their phases; advertising dead links would be worse than a shorter nav.
 */
const PRIMARY_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/category/india', label: 'India' },
  { to: '/category/world', label: 'World' },
  { to: '/category/technology', label: 'Technology' },
  { to: '/category/business', label: 'Business' },
  { to: '/category/finance', label: 'Finance' },
  { to: '/category/sports', label: 'Sports' },
  { to: '/category/ai', label: 'AI' },
  { to: '/category/science', label: 'Science' },
] as const;

export const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the drawer on navigation, otherwise it stays open over the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent the page behind the drawer from scrolling while it is open.
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  // Escape closes the drawer: expected for any modal surface.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--surface)]/85 backdrop-blur-md">
      {/* Keyboard users should be able to skip the whole nav block. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              className="rounded-md p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] lg:hidden"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <Logo />
          </div>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {PRIMARY_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={'end' in link ? link.end : false}
                    className={({ isActive }) =>
                      cn(
                        'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'text-[var(--text-primary)] after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-brand-600 after:content-[""]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled
              title="Search arrives in a later phase"
              aria-label="Search (not yet available)"
              className="rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Search className="size-[18px]" aria-hidden="true" />
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Category rail: the secondary nav row, hidden on the article page's own
            scroll context but present across the app for fast section switching. */}
        <div className="hidden border-t border-[var(--border-subtle)] py-1.5 sm:block">
          <CategoryRail />
        </div>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-fade-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-[var(--surface)] p-5 shadow-xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Mobile">
              <ul className="flex flex-col gap-1">
                {PRIMARY_LINKS.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={'end' in link ? link.end : false}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors',
                          isActive
                            ? 'bg-[var(--surface-sunken)] text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]',
                        )
                      }
                    >
                      {link.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <Link
              to="/explore"
              className="mt-4 rounded-lg border border-[var(--border-subtle)] px-3 py-2.5 text-center text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)]"
            >
              Browse all categories
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
