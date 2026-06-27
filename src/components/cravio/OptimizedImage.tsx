import { useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { resolveImage, type ImageRef, type ImageType } from "@/lib/image-service";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | ImageRef;
  type?: ImageType;
  /** Skeleton + fade-in while the image decodes. Defaults to true. */
  showSkeleton?: boolean;
  fallback?: string;
};

/**
 * Drop-in <img> replacement with:
 * - lazy loading + async decoding by default
 * - skeleton shimmer while loading
 * - fade-in once decoded
 * - error fallback
 *
 * Reads through `resolveImage` so swapping to InsForge later only touches one file.
 */
export function OptimizedImage({
  src,
  type = "dish",
  showSkeleton = true,
  fallback,
  className,
  alt = "",
  loading = "lazy",
  decoding = "async",
  onLoad,
  onError,
  ...rest
}: Props) {
  const initialUrl = resolveImage(src, type);
  const [url, setUrl] = useState(initialUrl);
  const [loaded, setLoaded] = useState(false);
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
        loading={loading}
        decoding={decoding}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={(e) => { setLoaded(true); onLoad?.(e); }}
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
