"use client";

import { useEffect, useState } from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

/**
 * This app toggles theme by mutating the `dark`/`dim` class on
 * `document.documentElement` directly (see ThemeToggle.tsx) rather than
 * through next-themes, so this reads that class — including live toggles,
 * via a MutationObserver — instead of the usual next-themes `useTheme()`.
 *
 * Sonner only knows light/dark. `dim` shares dark's light-on-dark contrast
 * direction (see globals.css), so it buckets with "dark" here too — the
 * per-token colors underneath still come from `dim`'s own CSS variables.
 */
export function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setTheme(
        root.classList.contains("dark") || root.classList.contains("dim")
          ? "dark"
          : "light",
      );
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <SonnerToaster
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      theme={theme}
      {...props}
    />
  );
}
