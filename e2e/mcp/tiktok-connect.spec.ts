import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`TikTok sandbox modal is responsive in ${theme} at ${width}px`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 950 });
      await page.addInitScript(
        (value) =>
          document.addEventListener("DOMContentLoaded", () =>
            document.documentElement.classList.toggle("dark", value === "dark"),
          ),
        theme,
      );
      await page.goto("/tiktok-connect.html");
      expect(
        await page.evaluate(() => localStorage.getItem("tiktokSetupLoaded")),
      ).toBeNull();
      await expect(
        page.getByRole("button", { name: "Disabled TikTok" }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "Connect TikTok", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(/Check the account shown before approving/),
      ).toBeVisible();
      await expect(
        dialog.getByText(/keep up to ten target accounts connected/),
      ).toBeVisible();
      await expect(
        dialog.getByText("https://studio.example/api/tiktok/callback"),
      ).toBeVisible();
      await expect(dialog.getByLabel("Sandbox Client Secret")).toHaveAttribute(
        "type",
        "password",
      );
      await dialog.getByLabel("Sandbox Client Key").fill("test-sandbox");
      await dialog.getByLabel("Sandbox Client Secret").fill("test-secret");
      await page.screenshot({
        path: info.outputPath(`tiktok-${theme}-${width}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await dialog.evaluate(
          (element) => element.scrollWidth <= element.clientWidth,
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      expect(
        await page.evaluate(() => localStorage.getItem("tiktokStartCount")),
      ).toBeNull();
      await page
        .getByRole("button", { name: "Connect TikTok", exact: true })
        .click();
      await expect(dialog.getByLabel("Sandbox Client Secret")).toHaveValue("");
      expect(errors).toEqual([]);
    });
  }

test("failed connection retains form values, prevents repeat clicks and permits retry", async ({
  page,
}) => {
  await page.goto("/tiktok-connect.html");
  await page
    .getByRole("button", { name: "Connect TikTok", exact: true })
    .click();
  await page.getByLabel("Sandbox Client Key").fill("error");
  await page.getByLabel("Sandbox Client Secret").fill("test-secret");
  await page.getByRole("button", { name: "Continue to TikTok" }).click();
  await expect(
    page.getByRole("button", { name: "Connecting…" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("could not start");
  expect(
    await page.evaluate(() => localStorage.getItem("tiktokStartCount")),
  ).toBe("1");
  await expect(page.getByLabel("Sandbox Client Key")).toHaveValue("error");
  await expect(page.getByLabel("Sandbox Client Secret")).toHaveValue(
    "test-secret",
  );
  await expect(
    page.getByRole("button", { name: "Continue to TikTok" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("successful submit navigates to TikTok without sending the secret in the URL", async ({
  page,
}) => {
  let authorizations = 0;
  await page.route("https://www.tiktok.com/**", async (route) => {
    authorizations++;
    expect(route.request().url()).not.toContain("test-secret");
    await route.fulfill({
      contentType: "text/html",
      body: "<h1>TikTok consent</h1>",
    });
  });
  await page.goto("/tiktok-connect.html");
  await page
    .getByRole("button", { name: "Connect TikTok", exact: true })
    .click();
  await page.getByLabel("Sandbox Client Key").fill("test-sandbox");
  await page.getByLabel("Sandbox Client Secret").fill("test-secret");
  await page.getByRole("button", { name: "Continue to TikTok" }).click();
  await expect(
    page.getByRole("heading", { name: "TikTok consent" }),
  ).toBeVisible();
  expect(authorizations).toBe(1);
});
