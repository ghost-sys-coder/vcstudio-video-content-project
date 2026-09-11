import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorialSignoffNotice } from "@/components/projects/EditorialSignoffNotice";
import type { EditorialReviewView } from "@/lib/editorial/editorial-review-view";
import type { EditorialSignoffStatus } from "@/lib/editorial/editorial-review";

function render(
  status: EditorialSignoffStatus,
  overrides: Partial<EditorialReviewView> = {},
) {
  const view: EditorialReviewView = {
    claims: [],
    sources: [],
    summary: {
      total: 3,
      supported: 1,
      disputed: 1,
      unchecked: 1,
      stale: 0,
    },
    signoff: { status, reasons: [] },
    signedBy: null,
    readiness:
      "1 supported, 1 disputed, 1 unchecked of 3 claims. A supported claim means someone attached a source, not that this app verified it.",
    scriptFingerprint: "the script",
    ...overrides,
  };
  return renderToStaticMarkup(
    createElement(EditorialSignoffNotice, {
      view,
      canEdit: true,
      busy: false,
      onSignOff: () => undefined,
    }),
  );
}

describe("the four sign-off states", () => {
  it("each get their own headline, so none reads as another", () => {
    expect(render("none")).toContain("Nobody has signed off");
    expect(render("current")).toContain("against this exact script");
    expect(render("edited")).toContain("the script has changed since");
    expect(render("invalidated")).toContain("withdrawn by later changes");
  });
});

describe("what the notice promises", () => {
  it("says signing off checks nothing and blocks nothing", () => {
    const markup = render("current");
    expect(markup).toContain("It does not check anything");
    expect(markup).toContain("does not block approving the script");
  });

  it("carries the readiness line, including what nobody looked at", () => {
    expect(render("current")).toContain("1 unchecked of 3 claims");
  });
});

describe("the sign-off control", () => {
  it("is offered while the sign-off does not match the script", () => {
    for (const status of ["none", "edited", "invalidated"] as const)
      expect(render(status)).not.toContain('disabled=""');
  });

  it("is disabled once the sign-off already matches", () => {
    expect(render("current")).toContain('disabled=""');
  });
});

describe("reasons", () => {
  it("are listed literally rather than summarized away", () => {
    const markup = render("invalidated", {
      signoff: {
        status: "invalidated",
        reasons: ["A reviewed sentence was edited after sign-off: X."],
      },
    });
    expect(markup).toContain("A reviewed sentence was edited after sign-off");
  });
});
