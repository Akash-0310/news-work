import { Bookmark, Compass, Home, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/utils/cn';

/**
 * Mobile bottom navigation.
 *
 * Thumb-reachable primary navigation on phones, hidden from `lg` up where the header
 * nav takes over.
 *
 * Bookmarks and Profile require authentication (Phases 5-6). They are shown but
 * disabled rather than hidden, so the information architecture is stable -- items
 * appearing in the bar later would move the ones already there and retrain muscle
 * memory.
 *
 * `pb-[env(safe-area-inset-bottom)]` keeps the bar clear of the iOS home indicator.
 */
const ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true, enabled: true },
  { to: '/explore', label: 'Explore', icon: Compass, end: false, enabled: true },
  { to: '/bookmarks', label: 'Saved', icon: Bookmark, end: false, enabled: false },
  { to: '/profile', label: 'Profile', icon: User, end: false, enabled: false },
] as const;

export const MobileNav = () => (
  <nav
    aria-label="Primary mobile"
    className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
  >
    <ul className="mx-auto flex max-w-md items-stretch">
      {ITEMS.map((item) => {
        const Icon = item.icon;

        if (!item.enabled) {
          return (
            <li key={item.to} className="flex-1">
              <span
                aria-disabled="true"
                title="Available once sign-in is enabled"
                className="flex cursor-not-allowed flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-[var(--text-muted)] opacity-40"
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
              </span>
            </li>
          );
        }

        return (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-[var(--text-muted)]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn('size-5', isActive && 'fill-current/10')}
                    aria-hidden="true"
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  </nav>
);
