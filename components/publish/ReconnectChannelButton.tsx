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

  return (
    <Button
      aria-busy={pending}
      aria-label={`Reconnect ${accountName} (${platformLabel})`}
      disabled={disabled}
      nativeButton={false}
      onClick={(event) => {
        if (disabled || pending) {
          event.preventDefault();
          return;
        }
        // Modified clicks open a new tab; leave those to the browser.
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        // Navigate explicitly: the pending re-render happens before the
        // browser's default link action, which could otherwise be cancelled.
        event.preventDefault();
        setPending(true);
        window.location.assign(href);
      }}
      render={<a href={disabled ? undefined : href} />}
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
