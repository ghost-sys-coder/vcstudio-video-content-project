import type { ReactNode } from "react";

/** Match the navbar's 12px inset after ApplicationShell's 3/5/6px main padding. */
export function SocialPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-[9px] min-w-0 sm:mx-[7px] lg:mx-1.5">{children}</div>
  );
}
