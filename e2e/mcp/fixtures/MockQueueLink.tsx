import type { ComponentProps } from "react";

export default function MockQueueLink({
  href,
  prefetch,
  onClick,
  ...props
}: ComponentProps<"a"> & { href: string; prefetch?: boolean }) {
  void prefetch;
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        window.history.pushState(null, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }}
    />
  );
}
