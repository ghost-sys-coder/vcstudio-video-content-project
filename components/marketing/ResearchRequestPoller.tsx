"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ResearchRequestPoller() {
  const router = useRouter();
  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 5_000);
    const timeout = window.setTimeout(
      () => window.clearInterval(interval),
      120_000,
    );
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [router]);
  return null;
}
