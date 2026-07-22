import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { LandingFooter } from "@/components/landing/LandingFooter";

const sectionClassName = "space-y-4 scroll-mt-24";
const headingClassName =
  "text-2xl font-semibold tracking-tight text-foreground";
const listClassName = "ml-5 list-disc space-y-2 marker:text-[#839eb1]";
const linkClassName =
  "font-medium text-foreground underline decoration-[#839eb1] underline-offset-4 transition-colors hover:text-[#607f94]";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 lg:px-8">
          <Link aria-label="VCStudio home" href="/">
            <BrandLogo />
          </Link>
          <Link className={linkClassName} href="/">
            Back to VCStudio
          </Link>
        </div>
      </header>

      <main>
        <article className="mx-auto max-w-5xl px-6 py-16 lg:px-8 lg:py-24">
          <header className="max-w-3xl border-b pb-12">
            <p className="font-mono text-xs font-semibold tracking-[0.18em] text-[#607f94] uppercase">
              Legal
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Privacy Policy
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              This policy explains how VCStudio handles personal information,
              production assets, and data from connected publishing platforms.
            </p>
            <p className="mt-6 inline-flex rounded-full border bg-muted/40 px-4 py-2 font-mono text-sm font-medium">
              Last updated: July 22, 2026
            </p>
          </header>

          <div className="mt-12 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
            <nav
              aria-label="Privacy policy sections"
              className="lg:sticky lg:top-8 lg:self-start"
            >
              <p className="mb-3 text-sm font-semibold">On this page</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a className="hover:text-foreground" href="#information">
                    Information we collect
                  </a>
                </li>
                <li>
                  <a className="hover:text-foreground" href="#platforms">
                    Connected platforms
                  </a>
                </li>
                <li>
                  <a className="hover:text-foreground" href="#use">
                    How we use data
                  </a>
                </li>
                <li>
                  <a className="hover:text-foreground" href="#sharing">
                    Sharing and retention
                  </a>
                </li>
                <li>
                  <a className="hover:text-foreground" href="#rights">
                    Your choices and rights
                  </a>
                </li>
                <li>
                  <a className="hover:text-foreground" href="#contact">
                    Contact us
                  </a>
                </li>
              </ol>
            </nav>

            <div className="space-y-12 leading-7 text-muted-foreground">
              <section className={sectionClassName} id="introduction">
                <h2 className={headingClassName}>1. Introduction</h2>
                <p>
                  VCStudio is an AI-powered content creation and social
                  publishing product operated by VeilCode Studio in Uganda. This
                  policy applies to the VCStudio website, application, APIs, and
                  integrations. It describes data controlled by VCStudio
                  separately from data controlled by third-party platforms.
                </p>
              </section>

              <section className={sectionClassName} id="information">
                <h2 className={headingClassName}>2. Information you provide</h2>
                <p>Depending on how you use VCStudio, you may provide:</p>
                <ul className={listClassName}>
                  <li>account details, such as your name and email address;</li>
                  <li>
                    profile, workspace, membership, role, and project
                    information;
                  </li>
                  <li>
                    prompts, scripts, images, character references, audio,
                    videos, captions, publishing settings, and other uploaded
                    files;
                  </li>
                  <li>
                    content briefs, generated outputs, approval choices,
                    budgets, and production history; and
                  </li>
                  <li>
                    support messages, feedback, and related communications.
                  </li>
                </ul>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  3. Authentication and account providers
                </h2>
                <p>
                  VCStudio currently uses Clerk to authenticate users and may
                  support sign-in through providers such as Google when
                  configured through Clerk. Authentication providers may process
                  identity, session, device, and security information under
                  their own privacy terms. Passwords handled directly by those
                  providers are not stored by VCStudio unless VCStudio
                  explicitly introduces a direct password feature and updates
                  this policy.
                </p>
              </section>

              <section className={sectionClassName} id="platforms">
                <h2 className={headingClassName}>
                  4. Connected social media accounts
                </h2>
                <p>
                  Workspace owners can authorize supported third-party
                  destinations. Depending on the platform and permission
                  granted, VCStudio may receive account identifiers, usernames,
                  profile details, Page or channel information, granted scopes,
                  access and refresh tokens, token expiration information,
                  upload status, publishing results, and published-content
                  identifiers or links.
                </p>
                <p>
                  VCStudio accesses only information allowed by the user and the
                  relevant platform. Tokens are encrypted before database
                  storage, access is restricted to server-side publishing
                  operations, and disconnecting a destination destroys its
                  stored credentials while preserving non-secret publishing
                  history. VCStudio does not sell connected-platform data.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>5. TikTok data</h2>
                <p>
                  VCStudio can currently prepare TikTok-targeted titles and
                  thumbnails, but TikTok account connection and direct
                  publishing are not enabled in the current application.
                  VCStudio therefore does not currently request TikTok account
                  scopes or store TikTok authorization tokens.
                </p>
                <p>
                  If TikTok integration is enabled later, VCStudio will use only
                  approved scopes to authenticate the account, display
                  connected-account information, and publish when the user takes
                  an explicit action or configures an available scheduling
                  instruction. Users will be able to disconnect TikTok and
                  request deletion through the methods described below.
                </p>
                <aside className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
                  Developer review note: before enabling TikTok Login Kit or
                  Content Posting API access, document the exact approved
                  scopes, data fields, revocation route, and retention behavior
                  here.
                </aside>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  6. Meta, Facebook, and Instagram data
                </h2>
                <p>
                  VCStudio uses approved Meta permissions to list Facebook Pages
                  a user manages, let the user select a Page, and publish
                  requested Page videos. It also supports direct Instagram Login
                  for professional Business and Creator accounts to identify the
                  account and publish requested Reels. This may involve Page or
                  Instagram account identifiers, names, profile links,
                  permissions, encrypted tokens, publishing status, media
                  identifiers, and permalinks.
                </p>
                <p>
                  This information is used for account selection, authorization,
                  processing, and publishing initiated by an authorized
                  workspace member. Workspace owners can disconnect a Meta or
                  Instagram destination in workspace settings and can request
                  deletion of related VCStudio data.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  7. YouTube and Google API data
                </h2>
                <p>
                  VCStudio uses Google OAuth and the YouTube Data API to
                  identify an authorized YouTube channel and upload videos
                  requested by the user. Data may include channel identifiers
                  and names, granted scopes, encrypted authorization tokens,
                  token expiration, upload status, video identifiers, links,
                  visibility, and publishing metadata.
                </p>
                <p>
                  VCStudio&apos;s use and transfer of information received from
                  Google APIs will comply with the{" "}
                  <a
                    className={linkClassName}
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    rel="noreferrer"
                    target="_blank"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including its Limited Use requirements.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  8. Automatically collected information
                </h2>
                <p>
                  VCStudio and the infrastructure services that deliver it may
                  automatically process IP addresses, browser and device
                  information, request and usage logs, error and security logs,
                  cookies, session identifiers, and approximate location derived
                  from an IP address where available. The current application
                  does not enable a separate optional product-analytics SDK;
                  this policy will be updated if that changes.
                </p>
              </section>

              <section className={sectionClassName} id="use">
                <h2 className={headingClassName}>9. How information is used</h2>
                <ul className={listClassName}>
                  <li>operate, maintain, authenticate, and secure VCStudio;</li>
                  <li>
                    generate scripts, images, narration, subtitles, and other
                    requested content;
                  </li>
                  <li>
                    store workspaces, projects, assets, settings, and approval
                    history;
                  </li>
                  <li>
                    render videos and process durable or scheduled maintenance
                    jobs;
                  </li>
                  <li>
                    publish content to destinations authorized and selected by
                    users;
                  </li>
                  <li>maintain publishing and usage history;</li>
                  <li>provide support and respond to feedback;</li>
                  <li>monitor reliability, fraud, abuse, and security;</li>
                  <li>improve product functionality; and</li>
                  <li>meet legal and connected-platform policy obligations.</li>
                </ul>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>10. AI processing</h2>
                <p>
                  Prompts, scripts, project information, reference assets, and
                  other content may be sent to AI providers such as OpenAI to
                  produce requested text, images, or audio. Provider processing
                  and retention depend on the applicable service configuration
                  and terms. Avoid submitting sensitive personal information
                  unless it is necessary for your intended output.
                </p>
                <p>
                  AI output may be incomplete, inaccurate, similar to other
                  content, unlawful in a particular context, or unsuitable for
                  publication. Users are responsible for reviewing generated
                  material and confirming that they have the rights and
                  permissions required to use and publish it.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>11. Service providers</h2>
                <p>
                  VCStudio uses service providers to operate the product.
                  Current categories and services include Vercel for application
                  hosting, Neon for PostgreSQL, Clerk for authentication,
                  Cloudflare R2 for private object storage, Trigger.dev for
                  background job processing, OpenAI for requested AI generation,
                  and Google, YouTube, Meta, Facebook, and Instagram APIs for
                  authorized publishing features. These providers process data
                  according to their roles, configurations, and terms. VCStudio
                  does not claim unverified certifications or protections for
                  these providers.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  12. Cookies and similar technologies
                </h2>
                <p>
                  Necessary cookies and local browser storage support
                  authentication, security, sessions, active-workspace
                  selection, sidebar preferences, and temporary OAuth flows.
                  These are required for the requested application features.
                  Optional analytics cookies are not currently set by VCStudio
                  application code; if optional analytics are introduced,
                  VCStudio will distinguish them from necessary cookies and
                  provide any consent controls required by applicable law.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>13. Legal bases</h2>
                <p>
                  Where data-protection law requires a legal basis, processing
                  may rely on performance of a contract, legitimate interests
                  such as operating and securing the service, consent for
                  optional connections or features, and compliance with legal
                  obligations. The available bases and rights vary by
                  jurisdiction, and not every basis applies in every country.
                </p>
              </section>

              <section className={sectionClassName} id="sharing">
                <h2 className={headingClassName}>14. Data sharing</h2>
                <p>
                  Information may be shared with service providers acting for
                  VCStudio, connected platforms when a user requests an
                  integration action, legal authorities when required by law or
                  necessary to protect rights and safety, and parties involved
                  in a merger, acquisition, financing, reorganization, or sale
                  of all or part of the business. VCStudio does not sell
                  personal information.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>15. Data retention</h2>
                <p>
                  VCStudio retains information for as long as needed to provide
                  the service, maintain authorized production and publishing
                  history, comply with legal obligations, resolve disputes,
                  enforce agreements, and protect security. Retention differs by
                  data type and account state. Encrypted backups and
                  provider-managed recovery copies may take additional time to
                  expire after deletion from active systems.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>16. Data deletion</h2>
                <p>
                  Workspace owners can disconnect supported integrations in
                  VCStudio workspace settings. To request deletion of a VCStudio
                  account and associated data, follow the{" "}
                  <Link className={linkClassName} href="/data-deletion">
                    Data Deletion Instructions
                  </Link>{" "}
                  or email us using the address below. We may need to verify
                  identity and preserve limited records where legally or
                  operationally required.
                </p>
                <p>
                  Deleting VCStudio data does not automatically delete content
                  already published to YouTube, Facebook, Instagram, or another
                  destination. Users may need to remove published content
                  directly through the connected platform.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>17. Data security</h2>
                <p>
                  VCStudio uses reasonable administrative, technical, and
                  organizational safeguards, including encrypted network
                  transport provided by deployed services, private object
                  storage, server-side secrets, role-based workspace access,
                  workspace-scoped database queries, restricted credential
                  access, encrypted token storage, signed asset URLs, webhook
                  signature verification, and operational logging. No system or
                  transmission method is completely secure.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  18. International data transfers
                </h2>
                <p>
                  VCStudio and its providers may process information in
                  countries other than the country where a user lives. Privacy
                  laws and protections may differ between those locations.
                  Applicable provider and legal arrangements govern those
                  transfers; VCStudio does not claim a specific transfer
                  mechanism where it has not been confirmed.
                </p>
              </section>

              <section className={sectionClassName} id="rights">
                <h2 className={headingClassName}>19. Your rights</h2>
                <p>
                  Depending on your jurisdiction, you may have rights to access,
                  correct, delete, restrict, object to processing, receive a
                  portable copy of information, withdraw consent, or complain to
                  an appropriate regulator. Withdrawal does not affect earlier
                  lawful processing. Contact us to make a request; identity
                  verification and lawful exceptions may apply.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>20. Children</h2>
                <p>
                  VCStudio is not intended for children under 13. Where local
                  law requires a higher minimum age, that higher threshold
                  applies. If we learn that an account belongs to an underage
                  user, we may restrict or remove it and delete associated
                  information as required.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>21. Third-party platforms</h2>
                <p>
                  Connected platforms have their own terms and privacy policies.
                  After VCStudio transmits authorized content or data to a
                  platform, that platform controls its own processing. VeilCode
                  Studio is not responsible for a third party&apos;s independent
                  privacy practices.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>
                  22. Account disconnection and revocation
                </h2>
                <p>
                  Workspace owners can disconnect supported Google/YouTube,
                  Meta/Facebook, and Instagram destinations through workspace
                  settings. Access can also be revoked in the relevant
                  provider&apos;s account or security settings. If TikTok is
                  enabled, equivalent disconnection instructions will be added.
                  Revocation stops future API access after it takes effect, but
                  does not necessarily remove data already stored under
                  VCStudio&apos;s retention rules or content already published
                  externally.
                </p>
              </section>

              <section className={sectionClassName}>
                <h2 className={headingClassName}>23. Changes to this policy</h2>
                <p>
                  We may update this policy as VCStudio, legal requirements, or
                  platform integrations change. The date at the top will
                  identify the latest version. Material changes may also be
                  communicated through the application, by email, or through
                  another reasonable notice.
                </p>
              </section>

              <section className={sectionClassName} id="contact">
                <h2 className={headingClassName}>24. Contact information</h2>
                <address className="not-italic">
                  <strong className="text-foreground">VeilCode Studio</strong>
                  <br />
                  Product: VCStudio
                  <br />
                  Country: Uganda
                  <br />
                  Email:{" "}
                  <a
                    className={linkClassName}
                    href="mailto:hello@veilcode.studio"
                  >
                    hello@veilcode.studio
                  </a>
                </address>
                <p>
                  You can also review the{" "}
                  <Link className={linkClassName} href="/terms">
                    Terms of Service
                  </Link>
                  , the{" "}
                  <Link className={linkClassName} href="/data-deletion">
                    Data Deletion Instructions
                  </Link>
                  , or return to the{" "}
                  <Link className={linkClassName} href="/">
                    VCStudio home page
                  </Link>
                  .
                </p>
              </section>
            </div>
          </div>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
