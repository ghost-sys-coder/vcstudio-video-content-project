"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4000;

/**
 * Character portrait generation status is server-rendered with no client
 * fetch loop of its own (unlike scene-image generation), so a completed
 * generation would otherwise stay showing "Queued" until a manual page
 * refresh. This polls the server component data while any row is still
 * queued/running and stops itself once nothing is pending.
 */
export function CharacterPortraitStatusPoller({
  hasPending,
}: {
  hasPending: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      router.refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasPending, router]);

  return null;
}
