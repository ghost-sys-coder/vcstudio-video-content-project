import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1440]) {
    test(`project footage choice and autonomous grant in ${theme} at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/project-creation.html?theme=${theme}`);
      const visual = page.getByRole("combobox", {
        name: "Default scene visuals",
        exact: true,
      });
      await expect(visual).toContainText("Still images");
      await visual.click();
      await expect(
        page.getByRole("option", { name: "Animated characters", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("option", { name: "Video footage", exact: true })
        .click();
      await page
        .getByLabel("Project name", { exact: true })
        .fill("Footage production");
      await page
        .getByRole("button", { name: "Create project", exact: true })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(sessionStorage.getItem("created-project") ?? "{}")
                .defaultVisualMedia,
          ),
        )
        .toBe("video");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("project-creation.png"),
        fullPage: true,
      });

      await page.goto("/harness.html?mode=settings-populated");
      await page.evaluate(
        (selectedTheme) =>
          document.documentElement.classList.toggle(
            "dark",
            selectedTheme === "dark",
          ),
        theme,
      );
      const card = page.locator('[data-slot="card"][aria-labelledby]').filter({
        has: page.getByRole("heading", { name: "ChatGPT", exact: true }),
      });
      const approval = card.getByRole("combobox", {
        name: "Publishing approval",
        exact: true,
      });
      await expect(approval).toContainText("Require my approval");
      await approval.click();
      await page
        .getByRole("option", { name: "Autonomous publishing", exact: true })
        .click();
      await card
        .getByRole("button", { name: "Save workspace permissions" })
        .click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(sessionStorage.getItem("saved-mcp-grant") ?? "{}")
                .publicationApprovalMode,
          ),
        )
        .toBe("autonomous");
      await expect(approval).toContainText("Autonomous publishing");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath("mcp-autonomy.png"),
        fullPage: true,
      });
      await card
        .getByRole("combobox", { name: "Workspace", exact: true })
        .click();
      await page.getByRole("option", { name: /Reference workspace/ }).click();
      await expect(approval).toContainText("Require my approval");
      await approval.click();
      await expect(
        page.getByRole("option", {
          name: "Autonomous publishing",
          exact: true,
        }),
      ).toHaveAttribute("aria-disabled", "true");
    });
  }
}

test("autonomous preview never asks for a human approval click", async ({
  page,
}) => {
  await page.goto("/host.html?autonomous=1");
  const frame = page.frameLocator('iframe[title="VCStudio review"]');
  await expect(
    frame.getByRole("heading", { name: "Prepared autonomous operation" }),
  ).toBeVisible();
  await expect(frame.getByRole("button", { name: /Approve/ })).toHaveCount(0);
  await expect(frame.getByText(/Nothing has been sent/)).toBeVisible();
});
