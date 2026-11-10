import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`generation manual review in ${theme} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (mode) =>
          document.addEventListener("DOMContentLoaded", () =>
            document.documentElement.classList.toggle("dark", mode === "dark"),
          ),
        theme,
      );
      await page.goto("/harness.html?mode=generation");
      await expect(
        page.getByRole("heading", { name: "Review media generation" }),
      ).toBeVisible();
      await expect(page.getByText("$0.08", { exact: true })).toBeVisible();
      await expect(page.getByText("$0.20", { exact: true })).toBeVisible();
      await expect(page.getByText(/Keep the whole composition/)).toBeVisible();
      if (width === 1440)
        await page.screenshot({
          path: `.vercel/mcp-generation-review-${theme}.png`,
          fullPage: true,
        });
      await page.getByRole("button", { name: "Approve generation" }).click();
      await expect(page.getByRole("status")).toContainText("Approval recorded");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
test("autonomous preparation shows no human checkpoint; expired manual proof cannot be clicked", async ({
  page,
}) => {
  await page.goto("/harness.html?mode=generation-auto");
  await expect(page.getByText(/trusted assistant can execute/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Approve generation" }),
  ).toHaveCount(0);
  await page.goto("/harness.html?mode=generation-expired");
  await expect(
    page.getByRole("button", { name: "Approve generation" }),
  ).toBeDisabled();
  await expect(page.getByRole("alert")).toContainText("expired");
});
test("embedded generation review consumes its private proof once", async ({
  page,
}) => {
  await page.goto("/host.html?generation&theme=dark");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Review media generation" }),
  ).toBeVisible();
  await expect(
    frame.getByText("A useful business update.", { exact: true }),
  ).toBeVisible();
  await frame.getByRole("button", { name: "Approve generation" }).click();
  await expect(frame.getByRole("status")).toContainText(
    "Generation authorized",
  );
  await expect(page.locator("body")).toHaveAttribute("data-approvals", "1");
  await expect(
    frame.getByRole("button", { name: "Approve generation" }),
  ).toBeDisabled();
});
test("embedded autonomous generation has no approval click", async ({
  page,
}) => {
  await page.goto("/host.html?generation&autonomous");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByText(/authorized assistant can call execute_generation/),
  ).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Approve generation" }),
  ).toHaveCount(0);
});
test("missing private proof disables embedded generation approval and preserves browser fallback", async ({
  page,
}) => {
  await page.goto("/host.html?generation&noProof");
  const frame = page.frameLocator("iframe");
  await expect(
    frame.getByRole("heading", { name: "Review media generation" }),
  ).toBeVisible();
  await expect(
    frame.getByRole("button", { name: "Approve generation" }),
  ).toBeDisabled();
  await expect(
    frame.getByRole("link", { name: "Review in VCStudio" }),
  ).toHaveAttribute("href", /app\/mcp\/operations/);
});

test("ElevenLabs video review shows the exact video request and credit valuation", async ({
  page,
}) => {
  await page.goto("/harness.html?mode=generation-video");
  await expect(
    page.getByRole("heading", { name: "Video prompt", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("16:9 · 720p · 8s", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/ElevenLabs estimates value subscription credits/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve generation" }).click();
  await expect(page.getByRole("status")).toContainText("Approval recorded");
});
