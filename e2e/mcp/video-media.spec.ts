import { expect, test } from "@playwright/test";
const poster =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#12574c"/><circle cx="320" cy="180" r="100" fill="#bcea3a"/><path d="M300 130L370 180L300 230Z" fill="#12574c"/></svg>';
for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`video thumbnails load without video bytes in ${theme} at ${width}px`, async ({
      page,
    }, info) => {
      let videos = 0,
        requests = 0,
        statusChecks = 0;
      await page.route("**/test-private-video.mp4", (route) => {
        videos++;
        return route.fulfill({ status: 404 });
      });
      await page.route("**/test-video-poster.jpg", (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: poster }),
      );
      await page.route("**/test-thumbnail-request", async (route) => {
        requests++;
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({ json: { status: "pending" } });
      });
      await page.route("**/test-thumbnail-status", (route) => {
        statusChecks++;
        return route.fulfill({ json: { status: "ready" } });
      });
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/video-media.html");
      await page.evaluate(
        (theme) =>
          document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      await expect(
        page.getByRole("img", { name: "Video: Video with preview" }),
      ).toBeVisible();
      await expect(page.locator("video")).toHaveCount(0);
      expect(videos).toBe(0);
      expect(requests).toBe(0);
      await page.getByRole("button", { name: /Existing video/ }).click();
      const player = page.locator("video");
      await expect(player).toHaveAttribute("preload", "none");
      expect(videos).toBe(0);
      await page
        .getByRole("button", { name: "Create video thumbnail", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Working…" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Check thumbnail status" }),
      ).toBeVisible();
      expect(requests).toBe(1);
      expect(statusChecks).toBe(0);
      await page
        .getByRole("button", { name: "Check thumbnail status" })
        .click();
      await expect(player).toHaveAttribute("poster", "/test-video-poster.jpg");
      await expect(
        page.getByRole("img", { name: "Video: Existing video" }),
      ).toBeVisible();
      expect(statusChecks).toBe(1);
      expect(videos).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("video-thumbnails.png"),
        fullPage: true,
      });
    });
  }
test("a broken thumbnail falls back without fetching the video", async ({
  page,
}) => {
  let videos = 0;
  await page.route("**/test-private-video.mp4", (route) => {
    videos++;
    return route.fulfill({ status: 404 });
  });
  await page.route("**/test-video-poster.jpg", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/video-media.html");
  const image = page.getByRole("img", { name: "Video: Video with preview" });
  await expect(image).toBeVisible();
  await expect(page.locator('img[src="/test-video-poster.jpg"]')).toHaveCount(
    0,
  );
  expect(videos).toBe(0);
});
test("failed thumbnail processing offers a retry and preserves the video", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/test-video-poster.jpg", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: poster }),
  );
  await page.route("**/test-thumbnail-request", (route) => {
    requests++;
    return route.fulfill({ json: { status: "pending" } });
  });
  await page.route("**/test-thumbnail-status", (route) =>
    route.fulfill({ json: { status: "failed" } }),
  );
  await page.goto("/video-media.html");
  await page.getByRole("button", { name: /Existing video/ }).click();
  await page
    .getByRole("button", { name: "Create video thumbnail", exact: true })
    .click();
  await page.getByRole("button", { name: "Check thumbnail status" }).click();
  await expect(page.getByRole("status")).toContainText(
    "original video is still available",
  );
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "/test-private-video.mp4",
  );
  await page
    .getByRole("button", { name: "Create video thumbnail", exact: true })
    .click();
  expect(requests).toBe(2);
});
