import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function AuthPageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden border-r bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <Link aria-label="VCStudio home" href="/">
          <BrandLogo />
        </Link>
        <div className="max-w-lg space-y-5">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-background/60">
            Production workspace
          </p>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
            Turn narration into a reviewable video pipeline.
          </h1>
          <p className="max-w-md text-base leading-7 text-background/70">
            Structure scenes, maintain visual continuity, approve assets, and
            render from one secure workspace.
          </p>
        </div>
        <p className="text-xs text-background/50">
          Internal production release
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">{children}</div>
      </section>
    </main>
  );
}
