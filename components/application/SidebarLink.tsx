"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { useSidebar } from "@/components/ui/sidebar";

export function SidebarLink({
  onNavigate,
  ...props
}: ComponentProps<typeof Link>) {
  const { setOpenMobile } = useSidebar();

  return (
    <Link
      {...props}
      onNavigate={(event) => {
        let cancelled = false;
        onNavigate?.({
          ...event,
          preventDefault() {
            cancelled = true;
            event.preventDefault();
          },
        });
        if (!cancelled) setOpenMobile(false);
      }}
    />
  );
}
