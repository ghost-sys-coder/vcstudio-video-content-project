import { Show, SignUpButton } from "@clerk/nextjs";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingDotGrid } from "@/components/landing/LandingDotGrid";
import { LandingHeroMockup } from "@/components/landing/LandingHeroMockup";
import { LandingPlatformPills } from "@/components/landing/LandingPlatformPills";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden border-b pb-24 pt-20 sm:pt-28">
      <LandingDotGrid />
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
          Plan · create · publish
        </p>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
          One studio for the full life of your content.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
          Ground campaigns in your brand, produce social posts and videos,
          animate consistent characters, create narration with approved voices,
          and publish across connected channels&mdash;with cost controls and
          human review built into the work.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Show when="signed-out">
            <SignUpButton>
              <Button className="rounded-full px-6" size="lg" type="button">
                Create account
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </SignUpButton>
            <Button
              className="rounded-full px-6"
              nativeButton={false}
              render={<a href="#studio" />}
              size="lg"
              variant="ghost"
            >
              Explore the studio
            </Button>
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
        <LandingPlatformPills />
      </div>
      <LandingHeroMockup />
    </section>
  );
}
