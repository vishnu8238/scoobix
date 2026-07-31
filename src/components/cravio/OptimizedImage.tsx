import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { resolveImage, type ImageRef, type ImageType } from "@/lib/image-service";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | ImageRef;
  type?: ImageType;
  /** Skeleton + fade-in while the image decodes. Defaults to true. */
  showSkeleton?: boolean;
  fallback?: string;
  /** Mark the one above-the-fold hero image so it loads eagerly. */
  priority?: boolean;
};

/**
 * Session-level memory of URLs the browser has already painted. A logo or
 * banner that appears on many screens then renders instantly, with no
 * skeleton flash and no re-decode cost.
 */
const painted = new Set<string>();

/** Responsive width hints per image role — keeps mobile from pulling desktop bytes. */
const SIZES: Partial<Record<ImageType, string>> = {
  logo: "64px",
  avatar: "64px",
  category: "96px",
  trending: "160px",
  dish: "(max-width: 640px) 45vw, 220px",
  cover: "(max-width: 640px) 100vw, 720px",
  banner: "(max-width: 640px) 100vw, 900px",
  discover: "(max-width: 640px) 70vw, 320px",
  ad: "(max-width: 640px) 100vw, 720px",
};

/**
 * Drop-in <img> replacement with:
 * - lazy loading + async decoding by default
 * - responsive `sizes` so small screens fetch small bytes
 * - skeleton shimmer while loading, skipped for already-painted URLs
 * - fade-in once decoded
 * - error fallback
 */
export function OptimizedImage({
  src,
  type = "dish",
  showSkeleton = true,
  fallback,
  priority = false,
  className,
  alt = "",
  loading,
  decoding = "async",
  sizes,
  onLoad,
  onError,
  ...rest
}: Props) {
  const initialUrl = resolveImage(src, type);
  const [url, setUrl] = useState(initialUrl);
  const [loaded, setLoaded] = useState(() => painted.has(initialUrl));
  const [errored, setErrored] = useState(false);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {showSkeleton && !loaded && !errored && (
        <div className="absolute inset-0 animate-pulse bg-primary/10" aria-hidden />
      )}
      <img
        {...rest}
        src={url}
        alt={alt}
        loading={loading ?? (priority ? "eager" : "lazy")}
        fetchPriority={priority ? "high" : "auto"}
        decoding={decoding}
        sizes={sizes ?? SIZES[type]}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={(e) => { painted.add(url); setLoaded(true); onLoad?.(e); }}
        onError={(e) => {
          if (fallback && url !== fallback) { setUrl(fallback); return; }
          setErrored(true);
          setLoaded(true);
          onError?.(e);
        }}
      />
    </div>
  );
}

