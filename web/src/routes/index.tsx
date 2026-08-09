import { lazy } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/**
 * Route table.
 *
 * Every page is lazily imported so the initial bundle contains only the shell and the
 * homepage. Opening an article should not have required downloading the category and
 * story pages first.
 *
 * The spec asks for top-level paths like `/india` and `/technology`. Those are
 * implemented as redirects into the single canonical `/category/:slug` route rather
 * than duplicated components, so a new category needs no route change and there is one
 * URL per resource for caching and analytics.
 */

const HomePage = lazy(() => import('@/pages/Home/HomePage'));
const CategoryPage = lazy(() => import('@/pages/Category/CategoryPage'));
const ArticlePage = lazy(() => import('@/pages/Article/ArticlePage'));
const StoryPage = lazy(() => import('@/pages/Article/StoryPage'));
const ExplorePage = lazy(() => import('@/pages/Category/ExplorePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFound/NotFoundPage'));

/** Category slugs that also answer at the root, per the spec's URL list. */
const TOP_LEVEL_CATEGORY_SLUGS = [
  'india',
  'world',
  'technology',
  'ai',
  'business',
  'economy',
  'finance',
  'stocks',
  'crypto',
  'sports',
  'cricket',
  'football',
  'science',
  'startups',
  'politics',
  'health',
  'entertainment',
  'education',
  'automobile',
  'software',
  'global-markets',
] as const;

const shortcutRoutes: RouteObject[] = TOP_LEVEL_CATEGORY_SLUGS.map((slug) => ({
  path: slug,
  element: <Navigate to={`/category/${slug}`} replace />,
}));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      { path: 'article/:id', element: <ArticlePage /> },
      { path: 'story/:slug', element: <StoryPage /> },
      ...shortcutRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
