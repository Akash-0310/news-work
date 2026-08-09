import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Article image with lazy loading and a graceful fallback.
 *
 * News images come from third parties and fail constantly -- hotlink protection, dead
 * CDNs, expired URLs. A broken-image icon in a feed looks like a broken app, so a
 * failed load swaps to a branded placeholder instead.
 *
 * The wrapper holds the aspect ratio so the layout never shifts between the skeleton,
 * the loaded image and the fallback.
 */
export const ArticleImage = ({
  src,
  alt,
  className,
  aspect = 'aspect-[16/9]',
  /** First screenful images should not be lazy: it delays LCP. */
  priority = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  aspect?: string;
  priority?: boolean;
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const showFallback = !src || failed;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)]',
        aspect,
        className,
      )}
    >
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center">
          <Newspaper className="size-8 text-[var(--text-muted)] opacity-40" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          className={cn(
            'h-full w-full object-cover transition-[opacity,transform] duration-500 group-hover:scale-[1.03]',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
};
