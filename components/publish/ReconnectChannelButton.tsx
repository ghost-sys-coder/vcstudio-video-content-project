"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Re-runs the platform's OAuth flow for an existing connection.
 *
 * A link rather than a button: authorization is a full-page navigation to the
 * provider. Choosing the same account there refreshes this connection in place.
 */
export function ReconnectChannelButton({
  accountName,
  disabled = false,
  emphasized,
  href,
  platformLabel,
}: {
  accountName: string;
  disabled?: boolean;
  /** True when the connection needs attention, so reconnecting is the fix. */
  emphasized: boolean;
  href: string;
  platformLabel: string;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // Returning from the provider may restore this page from the back/forward cache.
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const inactive = disabled || pending;

  return (
    <Button
      aria-busy={pending}
      aria-label={`Reconnect ${accountName} (${platformLabel})`}
      disabled={inactive}
      nativeButton={false}
      onClick={(event) => {
        if (inactive) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
      render={<a href={inactive ? undefined : href} />}
      role="link"
      size="sm"
      variant={emphasized ? "default" : "outline"}
    >
      {pending ? (
        <LoaderCircle aria-hidden className="animate-spin" />
      ) : (
        <RefreshCwIcon aria-hidden />
      )}
      {pending ? "Reconnecting…" : "Reconnect"}
    </Button>
  );
}
