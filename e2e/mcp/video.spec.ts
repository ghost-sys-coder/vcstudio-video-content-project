import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`video composer is responsive in ${theme} at ${width}px`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript((value) => {
        document.addEventListener("DOMContentLoaded", () =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        );
      }, theme);
      await page.goto("/video.html");
      await expect(
        page.getByRole("heading", { name: "Video Studio", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem("videoLibraryOpened")),
      ).toBeNull();
      const heights = await page
        .locator("#video-model,#video-title")
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().height),
        );
      expect(heights).toHaveLength(2);
      expect(heights[0]).toBe(heights[1]);
      await page
        .getByLabel("Describe your video")
        .fill("A restrained close-up of a plant moving in morning light.");
      await page.getByRole("button", { name: "Review estimate" }).click();
      await expect(
        page.getByRole("button", { name: "Getting estimate…" }),
      ).toBeVisible();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem("videoStarted")),
      ).toBeNull();
      await expect(page.getByText("Reserved estimate")).toBeVisible();
      await page.getByRole("button", { name: /Generate ·/ }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("Queued", { exact: true })).toHaveCount(2);
      expect(
        await page.evaluate(() => localStorage.getItem("videoStarted")),
      ).toBe("1");
      await page.getByRole("button", { name: "Cancel queued video" }).click();
      await expect(page.getByText("Cancelled", { exact: true })).toHaveCount(2);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`video-${theme}-${width}.png`),
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }
test("reference selection uses on-demand shadcn controls without leaving the form", async ({
  page,
}) => {
  await page.goto("/video.html");
  await page.getByLabel("Starting point").click();
  await page
    .getByRole("option", { name: "Image to video", exact: true })
    .click();
  await page.getByRole("button", { name: "Choose image" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Product reference" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Product reference", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Use as")).toContainText("first frame");
  await page.getByRole("button", { name: "Remove Product reference" }).click();
  await expect(
    page.getByText("Product reference", { exact: true }),
  ).toHaveCount(0);
});
test("approved project still is available as a first frame without a library copy", async ({
  page,
}) => {
  await page.goto("/video.html?mode=starter");
  await page
    .getByRole("button", { name: "Use approved scene image", exact: true })
    .click();
  await expect(
    page.getByText("Scene 1 approved image", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Starting point")).toContainText(
    "Image to video",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("videoLibraryOpened")),
  ).toBeNull();
  expect(
    await page.evaluate(() => localStorage.getItem("videoStarted")),
  ).toBeNull();
});
test("scene footage stays pending until explicit review and default selection saves visibly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/video.html?mode=scene");
  await expect(
    page.getByRole("heading", { name: "Scene visuals", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save visual default" }).click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Visual default saved");
  await page.getByLabel("Visual source").click();
  await page
    .getByRole("option", { name: "Video footage", exact: true })
    .click();
  await page.getByRole("button", { name: "Choose video" }).click();
  await page.getByRole("button", { name: "Inspected scene footage" }).click();
  await page
    .getByRole("checkbox", { name: "Loop short footage to cover narration" })
    .check();
  await page.getByRole("button", { name: "Save visual selection" }).click();
  await expect(page.getByText("Saved footage: pending")).toBeVisible();
  await page.getByRole("button", { name: "Approve saved footage" }).click();
  await expect(page.getByText("Saved footage: approved")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
