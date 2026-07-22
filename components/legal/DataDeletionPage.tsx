import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LandingFooter } from "@/components/landing/LandingFooter";

export function DataDeletionPage() {
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
              Privacy controls
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
              Data Deletion Instructions
            </h1>
            <p className="mt-5">Last updated: July 22, 2026</p>
          </header>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Disconnect a publishing account
            </h2>
            <p>
              A workspace owner can open Workspace settings in VCStudio and
              disconnect a supported YouTube, Facebook, or Instagram
              destination. This destroys the stored authorization credentials
              and stops future VCStudio API access for that connection. You can
              also revoke access in the provider&apos;s account settings.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Request account and project deletion
            </h2>
            <p>
              Email{" "}
              <a
                className="font-medium text-foreground underline underline-offset-4"
                href="mailto:hello@veilcode.studio?subject=VCStudio%20data%20deletion%20request"
              >
                hello@veilcode.studio
              </a>{" "}
              from the address associated with your VCStudio account. Use the
              subject “VCStudio data deletion request” and identify the account
              or workspace concerned. VeilCode Studio may ask you to verify your
              identity and authority over shared workspace data before acting.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              What deletion does not remove
            </h2>
            <p>
              Deleting VCStudio data does not delete content already published
              to an external platform. Remove that content through YouTube,
              Facebook, Instagram, or the applicable provider. Limited records
              may be retained where required for legal obligations, dispute
              resolution, security, or backup expiration.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-2xl font-semibold text-foreground">
              Questions
            </h2>
            <p>
              See the{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href="/privacy"
              >
                Privacy Policy
              </Link>{" "}
              for retention, sharing, and user-rights information, or contact
              VeilCode Studio at the email above.
            </p>
          </section>
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}
