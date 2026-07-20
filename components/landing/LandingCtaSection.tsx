import { Show, SignUpButton } from "@clerk/nextjs";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingDotGrid } from "@/components/landing/LandingDotGrid";

export function LandingCtaSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border bg-muted/30 px-8 py-16 text-center sm:px-16">
          <LandingDotGrid />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_60%_at_50%_0%,rgba(131,158,177,0.22),transparent)]"
          />
          <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Bring a script. Leave with a reviewed video.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Set a budget, invite your team, and put every generated scene,
            image, and clip through an approval step before it ships.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Show when="signed-out">
              <SignUpButton>
                <Button className="rounded-full px-6" size="lg" type="button">
                  Create account
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Button
                className="rounded-full px-6"
                nativeButton={false}
                render={<Link href="/app" />}
                size="lg"
              >
                Open workspace
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}
