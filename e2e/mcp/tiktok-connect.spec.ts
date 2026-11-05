import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`one-click TikTok connection is responsive in ${theme} at ${width}px`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      let authorizations = 0;
      await page.route("**/api/tiktok/authorize", async (route) => {
        authorizations++;
        await route.fulfill({
          status: 307,
          headers: {
            location: "/test-tiktok-authorization",
          },
        });
      });
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/tiktok-connect.html");
      await page.evaluate(
        (value) =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      const connect = page.getByRole("link", {
        name: "Connect TikTok",
        exact: true,
      });
      await expect(connect).toHaveAttribute("href", "/api/tiktok/authorize");
      const disabled = page.getByRole("link", {
        name: "Disabled TikTok",
        exact: true,
      });
      await expect(disabled).toHaveAttribute("aria-disabled", "true");
      await expect(disabled).not.toHaveAttribute("href", /.+/);
      const tikTokBox = await connect.boundingBox();
      const linkedInBox = await page
        .getByRole("link", { name: "Connect LinkedIn", exact: true })
        .boundingBox();
      expect(
        tikTokBox &&
          linkedInBox &&
          Math.abs(tikTokBox.height - linkedInBox.height) <= 1,
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.locator('input[name="clientKey"], input[name="clientSecret"]'),
      ).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath(`tiktok-${theme}-${width}.png`),
        fullPage: true,
      });
      await connect.click();
      await expect(
        page.getByRole("heading", { name: "TikTok authorization" }),
      ).toBeVisible();
      expect(authorizations).toBe(1);
      expect(errors).toEqual([]);
    });
  }

test("connection shows progress and remains usable after returning from TikTok", async ({
  page,
}) => {
  let authorizations = 0;
  await page.route("**/api/tiktok/authorize", async (route) => {
    authorizations++;
    await route.fulfill({
      status: 307,
      headers: {
        location: "/test-tiktok-authorization",
      },
    });
  });
  await page.goto("/tiktok-connect.html");
  // Hold the first browser navigation so its visible pending state can be
  // inspected without Playwright waiting for the next document to commit.
  await page.evaluate(() =>
    window.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    }),
  );
  await page.getByRole("link", { name: "Connect TikTok", exact: true }).click();
  const pending = page.getByRole("link", { name: "Connecting…", exact: true });
  await expect(pending).toHaveAttribute("aria-busy", "true");
  await expect(pending).toHaveAttribute("aria-disabled", "true");
  expect(authorizations).toBe(0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PageTransitionEvent("pageshow", { persisted: true }),
    ),
  );
  await page.getByRole("link", { name: "Connect TikTok", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "TikTok authorization" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "Connect TikTok", exact: true }),
  ).toHaveAttribute("aria-busy", "false");
  await page
    .getByRole("link", { name: "Add another TikTok account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "TikTok authorization" }),
  ).toBeVisible();
  expect(authorizations).toBe(2);
});

test("keyboard activation opens authorization without a credential dialog", async ({
  page,
}) => {
  await page.route("**/api/tiktok/authorize", async (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Configured authorization route</h1>",
    }),
  );
  await page.goto("/tiktok-connect.html");
  await page.getByRole("link", { name: "Connect TikTok", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Configured authorization route" }),
  ).toBeVisible();
});
