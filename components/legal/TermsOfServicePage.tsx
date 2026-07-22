import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link aria-label="VCStudio home" href="/">
            <BrandLogo />
          </Link>
          <Link
            className="text-sm font-medium underline underline-offset-4"
            href="/"
          >
            Back to VCStudio
          </Link>
        </div>
      </header>
      <main>
        <article className="mx-auto max-w-4xl space-y-10 px-6 py-16 leading-7 text-muted-foreground">
          <header className="border-b pb-10">
            <p className="font-mono text-xs font-semibold tracking-[0.18em] text-[#607f94] uppercase">
              Legal
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
              Terms of Service
            </h1>
            <p className="mt-5">Last updated: July 22, 2026</p>
          </header>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Using VCStudio
            </h2>
            <p>
              VCStudio is operated by VeilCode Studio in Uganda. You must
              provide accurate account information, keep access credentials
              secure, and use the service only for lawful content-production and
              publishing activities.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Your content and connected accounts
            </h2>
            <p>
              You retain responsibility for content you submit, generate,
              approve, and publish. You must have the rights and permissions
              needed for uploaded assets and connected destinations. Connecting
              a platform authorizes VCStudio to perform only the actions you
              request through available features.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              AI-generated output
            </h2>
            <p>
              Generated material may be inaccurate, non-unique, unsuitable, or
              subject to third-party rights. Review every output before use or
              publication. VCStudio does not guarantee publishing performance,
              audience results, or uninterrupted provider availability.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Acceptable use
            </h2>
            <p>
              Do not use VCStudio to violate law, platform rules, privacy,
              intellectual-property rights, security controls, or the rights of
              another person. We may restrict access needed to protect users,
              providers, or the service.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Changes and contact
            </h2>
            <p>
              These terms may change as the service develops. Material updates
              may be communicated in the application or by email. Questions can
              be sent to{" "}
              <a
                className="font-medium text-foreground underline underline-offset-4"
                href="mailto:hello@veilcode.studio"
              >
                hello@veilcode.studio
              </a>
              . Review our{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href="/privacy"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}
