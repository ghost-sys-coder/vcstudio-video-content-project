import { LandingCtaSection } from "@/components/landing/LandingCtaSection";
import { LandingFeatureSection } from "@/components/landing/LandingFeatureSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingProductSection } from "@/components/landing/LandingProductSection";
import { LandingReviewSection } from "@/components/landing/LandingReviewSection";
import { LandingWorkflowSection } from "@/components/landing/LandingWorkflowSection";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <LandingNav />
      <LandingHero />
      <LandingProductSection />
      <LandingWorkflowSection />
      <LandingFeatureSection />
      <LandingReviewSection />
      <LandingCtaSection />
      <LandingFooter />
    </main>
  );
}
