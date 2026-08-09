import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { ApiError } from '@/services/api/client';
import { router } from '@/routes';
import { watchSystemTheme } from '@/store/theme.store';

/**
 * Query client.
 *
 * Created at module scope, not inside the component: a client recreated on re-render
 * would throw away the entire cache.
 *
 * Retry policy is deliberate. TanStack's default retries every failure three times,
 * which turns a 404 into four identical requests and makes a genuinely missing article
 * take four round trips to report. `ApiError.isRetryable` limits retries to network
 * errors, 5xx and 429 -- the failures where retrying can actually help.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError) return error.isRetryable && failureCount < 2;
        return failureCount < 1;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // News does change while a tab sits open, but refetching on every window focus is
      // aggressive for a reading app; the per-hook staleTime governs freshness instead.
      refetchOnWindowFocus: false,
      gcTime: 10 * 60_000,
    },
  },
});

export const App = () => {
  // Keeps the "system" theme preference following OS changes for the session.
  useEffect(() => watchSystemTheme(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};
