import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LandingAccountActions } from "@/components/landing/LandingAccountActions";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { LANDING_NAV_LINKS } from "@/lib/landing/landing-navigation";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-20 pt-4">
      <nav
        aria-label="Main navigation"
        className="app-public-container flex min-h-14 items-center justify-between gap-3 rounded-full border bg-background/80 px-3 py-1 shadow-sm backdrop-blur sm:px-6 lg:py-2"
      >
        <Link className="mr-auto shrink-0" href="/" aria-label="VCStudio home">
          <BrandLogo />
        </Link>
        <div className="hidden items-center gap-6 lg:flex">
          {LANDING_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="ml-3 hidden lg:block">
          <LandingAccountActions />
        </div>
        <LandingMobileNav />
      </nav>
    </header>
  );
}
