import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Theme preference.
 *
 * Zustand rather than context because the theme is read by unrelated components at
 * different depths, and a context update would re-render the whole tree.
 *
 * `system` is a first-class option, not the absence of a choice: it keeps following the
 * OS setting when the user changes it, which "light or dark only" cannot do.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  /** Cycles light -> dark -> system, for the single-button toggle in the header. */
  cycleTheme: () => void;
}

/** Must match the key read by the anti-flash script in index.html. */
const STORAGE_KEY = 'newsflow-theme';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

export const resolveTheme = (preference: ThemePreference): 'light' | 'dark' =>
  preference === 'system' ? (prefersDark() ? 'dark' : 'light') : preference;

/** Single place that touches the DOM, so the class can never disagree with the store. */
export const applyTheme = (preference: ThemePreference): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolveTheme(preference) === 'dark');
};

const ORDER: ThemePreference[] = ['light', 'dark', 'system'];

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      cycleTheme: () => {
        const next = ORDER[(ORDER.indexOf(get().theme) + 1) % ORDER.length] ?? 'system';
        applyTheme(next);
        set({ theme: next });
      },
    }),
    {
      name: STORAGE_KEY,
      // Re-apply on hydration: the inline script in index.html sets the class before
      // paint, but the store must agree with it once React takes over.
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

/**
 * Keeps `system` live. Without this listener, choosing "system" would only apply the
 * OS theme at load time and then ignore later changes.
 */
export const watchSystemTheme = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (): void => {
    if (useThemeStore.getState().theme === 'system') applyTheme('system');
  };

  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
};
