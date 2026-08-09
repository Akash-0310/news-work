import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { NewsGridSkeleton } from '@/components/common/Skeleton';

/**
 * Shell shared by every page: header, content, footer, mobile bottom nav.
 *
 * The `Suspense` boundary here is what makes route-level code splitting work -- lazy
 * page chunks suspend while loading and render the fallback instead of a blank screen.
 *
 * `pb-20 lg:pb-0` reserves space for the fixed bottom nav so the last article in a
 * feed is never hidden behind it.
 */
export const AppLayout = () => {
  const { pathname } = useLocation();

  // Restore scroll to top on navigation. A client-side router keeps the previous
  // scroll position, so following a link from halfway down a feed would otherwise land
  // the user halfway down the new page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main id="main-content" className="flex-1 pb-20 lg:pb-0">
        <Suspense
          fallback={
            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              <NewsGridSkeleton count={6} />
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
