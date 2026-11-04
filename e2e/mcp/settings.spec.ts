import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [390, 768, 1440]) {
    test(`AI settings structure and controls in ${theme} at ${width}px`, async ({
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
      const warnings: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") warnings.push(message.text());
      });
      await page.goto("/harness.html?mode=settings-populated");
      await expect(page.locator("html")).toHaveClass(
        theme === "dark" ? /dark/ : /^$/,
      );
      await expect(
        page.getByRole("heading", { name: "AI connections" }),
      ).toBeVisible();
      const badge = page
        .locator('[data-slot="badge"]')
        .filter({ hasText: /^MCP available$/ });
      await expect(badge).toBeVisible();
      expect(
        await badge.evaluate((el) => getComputedStyle(el).backgroundColor),
      ).not.toBe("rgba(0, 0, 0, 0)");
      await expect(
        page
          .getByRole("list", { name: "Connection setup steps" })
          .getByRole("listitem"),
      ).toHaveCount(3);
      await expect(
        page.getByRole("heading", { name: "ChatGPT", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Claude", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Awaiting approval", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("This download link expired.", { exact: false }),
      ).toBeVisible();
      const chatgpt = page
        .locator('[data-slot="card"][aria-labelledby]')
        .filter({
          has: page.getByRole("heading", { name: "ChatGPT", exact: true }),
        });
      await expect(chatgpt.getByRole("checkbox")).toHaveCount(5);
      await expect(
        chatgpt.getByRole("checkbox", { name: /Publish and schedule/ }),
      ).toBeChecked();
      await chatgpt
        .getByRole("button", { name: "Save workspace permissions" })
        .click();
      await expect(chatgpt.getByRole("status")).toHaveText(
        "Workspace permissions saved.",
      );
      await page
        .getByRole("button", { name: "Disconnect AI connection" })
        .click();
      await expect(page.getByRole("dialog")).toContainText(
        "remain on the Social calendar",
      );
      await page.getByRole("button", { name: "Keep connected" }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(warnings).toEqual([]);
      if (width === 1440)
        await page.screenshot({
          path: `.vercel/mcp-settings-${theme}.png`,
          fullPage: true,
        });
    });
  }
  test(`empty and paused settings in ${theme}`, async ({ page }) => {
    await page.addInitScript(
      (mode) =>
        document.addEventListener("DOMContentLoaded", () =>
          document.documentElement.classList.toggle("dark", mode === "dark"),
        ),
      theme,
    );
    await page.goto("/harness.html?mode=settings-empty");
    await expect(
      page.getByRole("heading", { name: "Your first connection starts here" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "No activity yet" }),
    ).toBeVisible();
    await page.goto("/harness.html?mode=settings-paused");
    await expect(
      page.getByText("Deployment paused", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "AI connections are paused",
    );
    await expect(
      page.getByRole("button", { name: "Save workspace permissions" }),
    ).toHaveCount(0);
  });
}

test("settings endpoint copies by keyboard and viewer scopes stay disabled", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/harness.html?mode=settings-populated");
  const copy = page.getByRole("button", { name: "Copy MCP endpoint" });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "MCP endpoint copied" }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://vcstudio.example/mcp",
  );
  const chatgpt = page.locator('[data-slot="card"][aria-labelledby]').filter({
    has: page.getByRole("heading", { name: "ChatGPT", exact: true }),
  });
  await chatgpt.getByRole("combobox").click();
  await page.getByRole("option", { name: /Reference workspace/ }).click();
  await expect(
    chatgpt.getByRole("checkbox", { name: /Read content/ }),
  ).toBeEnabled();
  await expect(
    chatgpt.getByRole("checkbox", { name: /Publish and schedule/ }),
  ).toBeDisabled();
  await expect(
    chatgpt.getByRole("checkbox", { name: /Publish and schedule/ }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("link", { name: "Publish post" }),
  ).toHaveAttribute("href", /workspaceId=11111111-1111-4111-8111-111111111111/);
});
