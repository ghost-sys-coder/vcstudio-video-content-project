"use client";

import { useEffect } from "react";
import { ApplicationErrorState } from "@/components/application/ApplicationErrorState";

export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the digest to the browser console for support correlation; the
    // full exception is captured server-side by Next.js, never shown to users.
    console.error("Application segment error", error.digest ?? error.message);
  }, [error]);

  return <ApplicationErrorState reset={reset} />;
}
