import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="overflow-hidden border-t">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row lg:px-8">
        <Link aria-label="VCStudio home" href="/">
          <BrandLogo />
        </Link>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3"
        >
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/#workflow"
          >
            Workflow
          </Link>
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/#features"
          >
            Features
          </Link>
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/terms"
          >
            Terms of Service
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {year} VCStudio. Review-driven AI video production.
        </p>
      </div>
      <p
        aria-hidden
        className="-mt-6 mb-[-0.12em] select-none text-center text-[18vw] leading-none font-semibold tracking-tighter text-foreground/4 sm:text-[12vw]"
      >
        VCStudio
      </p>
    </footer>
  );
}
