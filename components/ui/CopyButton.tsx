"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Copies one field's current value to the clipboard.
 *
 * It reports what actually happened rather than assuming success: the
 * Clipboard API is unavailable over plain HTTP and can be refused by the
 * browser, and a button that always flashes a tick would be lying. Nothing is
 * copied when the field is empty, because an empty clipboard write silently
 * destroys whatever the creator had copied before.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** What is being copied, for the accessible name. */
  label: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 2_000);
  }, [value]);

  const empty = value.trim() === "";

  return (
    <button
      aria-label={
        state === "copied"
          ? `${label} copied`
          : state === "failed"
            ? `${label} could not be copied`
            : `Copy ${label}`
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40",
        state === "failed" && "text-destructive",
        className,
      )}
      disabled={empty}
      onClick={() => void copy()}
      title={empty ? "Nothing to copy yet" : `Copy ${label}`}
      type="button"
    >
      {state === "copied" ? (
        <CheckIcon aria-hidden className="size-3.5" />
      ) : (
        <CopyIcon aria-hidden className="size-3.5" />
      )}
      <span aria-hidden>
        {state === "copied" ? "Copied" : state === "failed" ? "Failed" : "Copy"}
      </span>
    </button>
  );
}
