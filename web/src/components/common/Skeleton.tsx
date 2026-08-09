import { cn } from '@/utils/cn';

/**
 * Loading placeholders.
 *
 * Skeletons rather than spinners because they reserve the final layout, so content
 * does not jump when it arrives. Every skeleton is `aria-hidden` with a single live
 * region announcing "Loading" once -- otherwise a screen reader reads out dozens of
 * meaningless placeholder nodes.
 */

export const Skeleton = ({ className }: { className?: string }) => (
  <div
    aria-hidden="true"
    className={cn('animate-shimmer rounded-md bg-[var(--surface-sunken)]', className)}
  />
);

/** Wrap a group of skeletons so assistive tech hears one message, not many. */
export const SkeletonRegion = ({
  label = 'Loading content',
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) => (
  <div role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">{label}</span>
    {children}
  </div>
);

export const NewsCardSkeleton = () => (
  <div className="flex flex-col gap-3">
    <Skeleton className="aspect-[16/9] w-full rounded-[var(--radius-card)]" />
    <Skeleton className="h-3 w-20" />
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-5 w-4/5" />
    <Skeleton className="h-3 w-32" />
  </div>
);

export const NewsListItemSkeleton = () => (
  <div className="flex gap-4 py-4">
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-28" />
    </div>
    <Skeleton className="h-20 w-28 shrink-0 rounded-lg sm:h-24 sm:w-36" />
  </div>
);

export const NewsGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <SkeletonRegion label="Loading articles">
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <NewsCardSkeleton key={index} />
      ))}
    </div>
  </SkeletonRegion>
);

export const HeroSkeleton = () => (
  <SkeletonRegion label="Loading top stories">
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <Skeleton className="aspect-[16/9] w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
      <div className="space-y-5">
        {Array.from({ length: 4 }, (_, index) => (
          <NewsListItemSkeleton key={index} />
        ))}
      </div>
    </div>
  </SkeletonRegion>
);
