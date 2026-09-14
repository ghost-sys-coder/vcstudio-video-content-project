"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageOffIcon, Loader2Icon } from "lucide-react";
import {
  imageRetryDelayMilliseconds,
  shouldRetryImage,
  withImageRetryAttempt,
} from "@/lib/images/image-retry";

type LoadStatus = "loading" | "waiting" | "loaded" | "failed";

/**
 * A scene image that survives a bad connection.
 *
 * Three things a bare `img` does not do, all of which show up on slow networks:
 * it says nothing while loading, it gives up permanently on the first failure,
 * and once it has given up it looks identical to an image that was never
 * generated. Here the picture reports which of those it is, retries transient
 * failures on its own, and offers the retry by hand once the automatic ones are
 * spent.
 *
 * **Must be rendered inside a positioned element.** It fills its container and
 * lays its own states over the same box, so each call site keeps whatever
 * aspect ratio, ring and overlays it already had rather than having a wrapper
 * imposed on it here.
 */
export function RetryingImage({
  alt,
  className,
  priority,
  sizes,
  src,
  style,
}: {
  alt: string;
  className?: string;
  /** Fetch ahead of other images, for one the creator opened deliberately. */
  priority?: boolean;
  sizes?: string;
  src: string;
  style?: React.CSSProperties;
}) {
  const [source, setSource] = useState(src);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<LoadStatus>("loading");

  // A different picture is a new load, not a continuation of the last one's
  // failures. Adjusted during render rather than in an effect, which is the
  // documented way to reset state when a prop changes and avoids committing a
  // throwaway pass showing the previous image's error.
  if (source !== src) {
    setSource(src);
    setAttempt(0);
    setStatus("loading");
  }

  // The wait between attempts belongs to an effect, so that unmounting, a new
  // source, or a retry by hand all cancel it through the same cleanup.
  useEffect(() => {
    if (status !== "waiting") return;
    const timer = setTimeout(() => {
      setAttempt((current) => current + 1);
      setStatus("loading");
    }, imageRetryDelayMilliseconds(attempt));
    return () => clearTimeout(timer);
  }, [attempt, status]);

  const inProgress = status === "loading" || status === "waiting";

  return (
    <>
      {status === "failed" ? null : (
        <Image
          alt={alt}
          className={className}
          fill
          // Each attempt is its own element and its own URL, or the browser
          // answers from the cached failure and the retry changes nothing.
          key={attempt}
          onError={() =>
            // No error is shown while an automatic attempt is still in hand:
            // flashing one the creator cannot act on would be noise.
            setStatus(shouldRetryImage(attempt) ? "waiting" : "failed")
          }
          onLoad={() => setStatus("loaded")}
          priority={priority}
          sizes={sizes}
          src={withImageRetryAttempt(src, attempt)}
          style={style}
          unoptimized
        />
      )}

      {inProgress ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-muted/60"
          role="status"
        >
          <Loader2Icon
            aria-hidden
            className="size-5 animate-spin text-muted-foreground"
          />
          <span className="sr-only">
            {attempt > 0 ? "Retrying image…" : "Loading image…"}
          </span>
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-3 text-center">
          <ImageOffIcon aria-hidden className="size-5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            This image did not load. It is still saved.
          </p>
          <button
            className="rounded-md border px-2 py-1 text-xs font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={() => {
              setAttempt((current) => current + 1);
              setStatus("loading");
            }}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}
    </>
  );
}
