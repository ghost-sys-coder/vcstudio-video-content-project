import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "@/app/privacy/page";
import DataDeletionInstructionsPage from "@/app/data-deletion/page";
import TermsPage from "@/app/terms/page";
import { LandingFooter } from "@/components/landing/LandingFooter";

describe("public privacy policy", () => {
  it("renders as a public page without an authentication context", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("Last updated: July 22, 2026");
  });

  it("publishes the required SEO metadata", () => {
    expect(metadata).toMatchObject({
      title: "Privacy Policy | VCStudio",
      description:
        "Learn how VCStudio collects, uses, stores, and protects personal information and connected social platform data.",
      alternates: {
        canonical: "https://vcstudio.veilcode.studio/privacy",
      },
    });
  });

  it("keeps Privacy and Terms links visible in the public footer", () => {
    const html = renderToStaticMarkup(createElement(LandingFooter));
    expect(html).toContain('href="/privacy"');
    expect(html).toContain("Privacy Policy");
    expect(html).toContain('href="/terms"');
    expect(html).toContain("Terms of Service");
    expect(renderToStaticMarkup(createElement(TermsPage))).toContain(
      "Terms of Service",
    );
    expect(
      renderToStaticMarkup(createElement(DataDeletionInstructionsPage)),
    ).toContain("Data Deletion Instructions");
  });

  it.each([
    "TikTok data",
    "Meta, Facebook, and Instagram data",
    "YouTube and Google API data",
    "Google API Services User Data Policy",
    "Data deletion",
    "Contact information",
    "hello@veilcode.studio",
  ])("contains the required policy topic: %s", (topic) => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    expect(html).toContain(topic);
  });
});
