import { Link } from 'react-router-dom';
import { Logo } from './Logo';

const FOOTER_SECTIONS = [
  {
    title: 'News',
    links: [
      { to: '/category/india', label: 'India' },
      { to: '/category/world', label: 'World' },
      { to: '/category/politics', label: 'Politics' },
      { to: '/category/science', label: 'Science' },
    ],
  },
  {
    title: 'Business',
    links: [
      { to: '/category/business', label: 'Business' },
      { to: '/category/economy', label: 'Economy' },
      { to: '/category/finance', label: 'Finance' },
      { to: '/category/stocks', label: 'Stock Market' },
    ],
  },
  {
    title: 'Technology',
    links: [
      { to: '/category/technology', label: 'Technology' },
      { to: '/category/ai', label: 'AI' },
      { to: '/category/software', label: 'Software' },
      { to: '/category/startups', label: 'Startups' },
    ],
  },
  {
    title: 'Sport & Life',
    links: [
      { to: '/category/sports', label: 'Sports' },
      { to: '/category/cricket', label: 'Cricket' },
      { to: '/category/health', label: 'Health' },
      { to: '/category/entertainment', label: 'Entertainment' },
    ],
  },
] as const;

export const Footer = () => (
  <footer className="mt-16 border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--text-secondary)]">
            The day's most important news from India and around the world, grouped by story
            so you can compare how different outlets covered it.
          </p>
        </div>

        {FOOTER_SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-semibold">{section.title}</h3>
            <ul className="mt-3 space-y-2">
              {section.links.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} NewsFlow. A news aggregation demo project.</p>
        {/* Stated plainly: this is an aggregator, and the publisher owns the article. */}
        <p className="max-w-xl">
          NewsFlow links to original reporting and does not reproduce full articles.
          All headlines and excerpts remain the property of their publishers.
        </p>
      </div>
    </div>
  </footer>
);
