"use client";

import { useEffect, useState } from "react";
import { MenuIcon } from "lucide-react";
import { LandingAccountActions } from "@/components/landing/LandingAccountActions";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LANDING_NAV_LINKS } from "@/lib/landing/landing-navigation";
import { cn } from "@/lib/utils";

export function LandingMobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setOpen(false);
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            aria-label="Open navigation"
            className="size-11 rounded-full lg:hidden"
            size="icon-lg"
            type="button"
            variant="ghost"
          />
        }
      >
        <MenuIcon aria-hidden />
      </SheetTrigger>
      <SheetContent
        className="overflow-y-auto overscroll-contain data-[side=right]:w-[min(22rem,calc(100vw-2rem))] [&>[data-slot=sheet-close]]:size-11"
        side="right"
      >
        <SheetHeader className="pr-14">
          <SheetTitle>Explore VCStudio</SheetTitle>
          <SheetDescription>
            Explore the studio and manage your account.
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Mobile navigation"
          className="flex flex-col gap-1 px-4"
        >
          {LANDING_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "h-11 justify-start",
              )}
              href={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <LandingAccountActions
          className="mt-auto flex-col items-stretch border-t p-4"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
