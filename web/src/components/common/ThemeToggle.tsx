import { Monitor, Moon, Sun } from 'lucide-react';
import { useThemeStore, type ThemePreference } from '@/store/theme.store';
import { cn } from '@/utils/cn';

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<ThemePreference, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

/**
 * Single-button theme cycle: light -> dark -> system.
 *
 * A button rather than a dropdown because it is a three-state toggle used constantly;
 * the accessible name announces both the current state and what pressing it will do,
 * which a bare icon cannot convey.
 */
export const ThemeToggle = ({ className }: { className?: string }) => {
  const theme = useThemeStore((state) => state.theme);
  const cycleTheme = useThemeStore((state) => state.cycleTheme);

  const Icon = ICONS[theme];

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={`${LABELS[theme]}. Switch to ${LABELS[NEXT[theme]].toLowerCase()}`}
      title={LABELS[theme]}
      className={cn(
        'rounded-full p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
        className,
      )}
    >
      <Icon className="size-[18px]" aria-hidden="true" />
    </button>
  );
};
