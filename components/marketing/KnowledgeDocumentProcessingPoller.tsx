"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function KnowledgeDocumentProcessingPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 3_000);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      60_000,
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [router]);

  return (
    <span className="sr-only" aria-live="polite">
      Document processing is in progress.
    </span>
  );
}
