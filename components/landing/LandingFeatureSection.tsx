import { FEATURE_HIGHLIGHTS } from "@/lib/landing/landing-content";
import { LandingFeatureCard } from "@/components/landing/LandingFeatureCard";
import { LandingFeatureOrbit } from "@/components/landing/LandingFeatureOrbit";
import { LandingSectionHeading } from "@/components/landing/LandingSectionHeading";

export function LandingFeatureSection() {
  return (
    <section className="bg-[#0b0e13] py-24" id="features">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <LandingSectionHeading
          description="AI drafts the work. Your team decides what actually ships — and every generation is priced, versioned, and traceable."
          eyebrow="Built for accountable production"
          title="Speed without losing control of cost or quality."
          tone="inverted"
        />
        <LandingFeatureOrbit />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <LandingFeatureCard
              description={feature.description}
              icon={feature.icon}
              key={feature.title}
              title={feature.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
