import { Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="mx-auto flex h-16 max-w-7xl items-center border-b px-6 lg:px-8">
        <Link className="mr-auto" href="/" aria-label="VCStudio home">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <SignInButton>
              <Button type="button" variant="ghost">
                Sign in
              </Button>
            </SignInButton>
            <SignUpButton>
              <Button type="button">Create account</Button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Button nativeButton={false} render={<Link href="/app" />}>
              Open workspace
            </Button>
          </Show>
        </div>
      </nav>
      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-36">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Script to screen
          </p>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
            A production system for AI-assisted video, built for review.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
            Transform narration into scenes, consistent visual assets, audio,
            subtitles, and final renders without losing human approval or cost
            control.
          </p>
        </div>
        <aside className="self-end rounded-2xl border bg-muted/35 p-6">
          <p className="text-sm font-medium">Production foundation</p>
          <div className="mt-6 space-y-4 font-mono text-xs text-muted-foreground">
            <p>01 · Structured scene planning</p>
            <p>02 · Character and visual continuity</p>
            <p>03 · Human approval checkpoints</p>
            <p>04 · Budget-aware generation</p>
            <p>05 · Deterministic rendering</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
