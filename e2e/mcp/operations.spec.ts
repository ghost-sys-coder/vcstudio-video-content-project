import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1440]) {
    for (const mode of ["readiness", "usage"]) {
      test(`${mode} layout and controls in ${theme} at ${width}px`, async ({
        page,
      }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        await page.setViewportSize({ width, height: 1000 });
        await page.addInitScript(
          (value) =>
            document.addEventListener("DOMContentLoaded", () =>
              document.documentElement.classList.toggle(
                "dark",
                value === "dark",
              ),
            ),
          theme,
        );
        await page.goto(`/operations.html?mode=${mode}`);
        if (mode === "readiness") {
          await expect(
            page.getByRole("heading", {
              name: "Operational readiness",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { name: "Readiness overview" }),
          ).toBeVisible();
          await expect(page.getByText("Degraded", { exact: true })).toHaveCount(
            2,
          );
          await expect(page.getByText("Disabled", { exact: true })).toHaveCount(
            2,
          );
          await expect(page.getByText("Unknown", { exact: true })).toHaveCount(
            2,
          );
          await expect(
            page.getByText("Reconnect the affected destination", {
              exact: false,
            }),
          ).toBeVisible();
          await expect(
            page.getByText("5 Nov 2026, 08:15 UTC", { exact: true }),
          ).toBeVisible();
          await expect(page.locator("time")).toHaveAttribute(
            "datetime",
            "2026-11-05T08:15:00.000Z",
          );
        } else {
          await expect(
            page.getByRole("heading", { name: "Usage & budgets", exact: true }),
          ).toBeVisible();
          await expect(
            page.getByText("$45.73", { exact: true }).first(),
          ).toBeVisible();
          await expect(
            page.getByRole("progressbar", { name: "Today budget usage" }),
          ).toHaveAttribute("aria-valuenow", "43");
          await expect(
            page.getByRole("table", { name: "Spend by project", exact: true }),
          ).toContainText("$83.24");
          await expect(
            page.getByRole("table", { name: "Usage ledger", exact: true }),
          ).toContainText("$27.50");
          await expect(
            page.getByRole("heading", { name: "Marketing Studio" }),
          ).toHaveCount(0);
          await page.getByLabel("Daily budget (USD)").fill("17.25");
          await page
            .getByRole("button", { name: "Save budgets", exact: true })
            .click();
          await expect(page.getByRole("status")).toContainText(
            "Budget settings saved.",
          );
          expect(
            JSON.parse(
              await page.evaluate(
                () => localStorage.getItem("usage-budget-save") ?? "{}",
              ),
            ),
          ).toMatchObject({
            workspaceId: "11111111-1111-4111-8111-111111111111",
            dailyBudgetDollars: "17.25",
            monthlyBudgetDollars: "120.00",
            manualConfirmationThresholdDollars: "5.00",
          });
          await page.getByLabel("Images per batch").fill("9");
          await page
            .getByRole("button", { name: "Save limits", exact: true })
            .click();
          await expect(
            page.getByText("Operational limits saved.", { exact: true }),
          ).toBeVisible();
          expect(
            JSON.parse(
              await page.evaluate(
                () => localStorage.getItem("usage-limits-save") ?? "{}",
              ),
            ),
          ).toMatchObject({
            maxImagesPerBatch: "9",
            maxScenesPerAudioBatch: "4",
            maxRenderDurationSeconds: "180",
          });
          const ledgerNav = page.getByRole("navigation", {
            name: "Usage ledger pagination",
          });
          await expect(
            ledgerNav.getByRole("button", { name: "Previous" }),
          ).toBeDisabled();
          await expect(
            ledgerNav.getByRole("link", { name: "Next" }),
          ).toHaveAttribute("href", /ledgerPage=2/);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(errors).toEqual([]);
        if (width === 1440)
          await page.screenshot({
            path: `.vercel/${mode}-${theme}.png`,
            fullPage: true,
          });
      });
    }
  }
  test(`empty readiness and zero usage in ${theme}`, async ({ page }) => {
    await page.addInitScript(
      (value) =>
        document.addEventListener("DOMContentLoaded", () =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        ),
      theme,
    );
    await page.goto("/operations.html?mode=readiness&state=empty");
    await expect(
      page.getByText("Some readiness information is unavailable.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("No checks reported in this section.", { exact: true }),
    ).toHaveCount(2);
    await page.goto("/operations.html?mode=usage&state=empty");
    await expect(
      page.getByText("No budget available", { exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("progressbar", { name: "Today budget usage" }),
    ).toHaveAttribute("aria-valuenow", "0");
    await expect(
      page.getByText("No usage events recorded yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("No audit events recorded yet.", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Audit trail pagination" })
        .getByRole("button", { name: "Next" }),
    ).toBeDisabled();
  });
}

test("usage failures retain edits and audit filtering preserves ledger pagination", async ({
  page,
}) => {
  await page.goto(
    "/operations.html?mode=usage&fail=budget&ledgerPage=2&auditPage=2",
  );
  await page.getByLabel("Daily budget (USD)").fill("17.25");
  await page.getByRole("button", { name: "Save budgets", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "The budget could not be saved.",
  );
  await expect(page.getByLabel("Daily budget (USD)")).toHaveValue("17.25");
  await page.getByRole("combobox", { name: "Filter", exact: true }).click();
  await page
    .getByRole("option", { name: "Workspace created", exact: true })
    .click();
  const params = new URL(page.url()).searchParams;
  expect(params.get("auditAction")).toBe("workspace_created");
  expect(params.get("ledgerPage")).toBe("2");
  expect(params.has("auditPage")).toBe(false);
});
