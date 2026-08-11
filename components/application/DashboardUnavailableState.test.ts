import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { DashboardUnavailableState } from "@/components/application/DashboardUnavailableState";

describe("DashboardUnavailableState", () => {
  it("renders safe recovery guidance and a support reference", () => {
    const markup = renderToStaticMarkup(
      createElement(DashboardUnavailableState, {
        supportReference: "dashboard-ab12cd34",
      }),
    );

    expect(markup).toContain("We couldn’t load your workspace summary");
    expect(markup).toContain("Try again");
    expect(markup).toContain("Open projects");
    expect(markup).toContain("dashboard-ab12cd34");
    expect(markup).not.toContain("DrizzleQueryError");
    expect(markup).not.toContain("workspace_id");
  });
});
