import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional class names with conflict resolution.
 *
 * `clsx` handles conditionals; `twMerge` ensures a caller-supplied `className` actually
 * overrides a component's default rather than both landing in the class list and the
 * winner being decided by stylesheet order (e.g. `p-4` + `p-2` -> `p-2`).
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
