import { expect, test } from "@playwright/test";
import { uploadedImage, uploadedVideo } from "./fixtures/social-draft-data";

test("attach from library, save and reload retains the chosen file", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/post-composer.html");
  await page.getByRole("button", { name: "Attach media" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Library image one/ }).click();
  await dialog.getByRole("button", { name: "Attach 1" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Library image one" }),
  ).toBeVisible();
  const attachment = await page
    .getByRole("button", { name: "Remove Library image one" })
    .boundingBox();
  const chooser = await page
    .getByRole("button", { name: "Choose files" })
    .boundingBox();
  expect(attachment && chooser && attachment.y < chooser.y).toBe(true);
  await expect(
    page.getByText("Media changes are ready. Save the draft to keep them."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Library image one" }),
  ).toBeVisible();
});

test("a failed save keeps the selected media visible for retry", async ({
  page,
}) => {
  await page.goto("/post-composer.html");
  await page.getByRole("button", { name: "Attach media" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Library image one/ }).click();
  await dialog.getByRole("button", { name: "Attach 1" }).click();
  await page.evaluate(() => localStorage.setItem("fixture-save-error", "true"));
  await page.getByRole("button", { name: "Save draft changes" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your changes are still here",
  );
  await expect(
    page.getByRole("button", { name: "Remove Library image one" }),
  ).toBeVisible();
  await page.evaluate(() => localStorage.removeItem("fixture-save-error"));
  await page.getByRole("button", { name: "Save draft changes" }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Library image one" }),
  ).toBeVisible();
});

test("upload an image, save and reload retains the uploaded file", async ({
  page,
}) => {
  await page.route("**/api/workspaces/**/media/upload", async (route) =>
    route.fulfill({
      json: {
        mediaAssetId: uploadedImage.id,
        objectKey: "fixture",
        uploadUrl: "http://127.0.0.1:38173/mock-r2",
      },
    }),
  );
  await page.route("**/mock-r2", async (route) =>
    route.fulfill({ status: 200 }),
  );
  await page.route("**/api/workspaces/**/media/complete", async (route) =>
    route.fulfill({ json: { asset: uploadedImage } }),
  );
  await page.goto("/post-composer.html");
  await page.locator('input[type="file"]').setInputFiles({
    name: "uploaded.png",
    mimeType: "image/png",
    buffer: Buffer.from("mock-image"),
  });
  await expect(
    page.getByRole("button", { name: "Remove Uploaded image" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Uploaded image" }),
  ).toBeVisible();
});

test("uploaded video stays attached across save and reload while inspection blocks publication", async ({
  page,
}) => {
  await page.route("**/api/workspaces/**/media/upload", async (route) =>
    route.fulfill({
      json: {
        mediaAssetId: uploadedVideo.id,
        objectKey: "fixture",
        uploadUrl: "http://127.0.0.1:38173/mock-r2",
      },
    }),
  );
  await page.route("**/mock-r2", async (route) =>
    route.fulfill({ status: 200 }),
  );
  await page.route("**/api/workspaces/**/media/complete", async (route) =>
    route.fulfill({
      status: 202,
      json: { inspectionPending: true, asset: uploadedVideo },
    }),
  );
  await page.goto("/post-composer.html");
  await page.getByRole("checkbox", { name: /Tamale Frank/ }).check();
  await page.locator('input[type="file"]').setInputFiles({
    name: "uploaded.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("mock-video"),
  });
  await expect(
    page.getByText("Video verification in progress.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Uploaded video" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save draft changes" }).click();
  await expect(page.getByText(/Saved at/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Uploaded video" }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /Tamale Frank/ }),
  ).toBeChecked();
  await expect(
    page.getByText("A relevant saved post.", { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish now" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    localStorage.setItem("fixture-video-status", "ready"),
  );
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(
    page.getByText("Video verification in progress.", { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish now" })).toBeEnabled();
  expect(
    await page.evaluate(() => localStorage.getItem("unexpected-dispatch")),
  ).toBeNull();
});

test("a failed video inspection stays blocked and can be removed", async ({
  page,
}) => {
  await page.route("**/api/workspaces/**/media/upload", async (route) =>
    route.fulfill({
      json: {
        mediaAssetId: uploadedVideo.id,
        objectKey: "fixture",
        uploadUrl: "http://127.0.0.1:38173/mock-r2",
      },
    }),
  );
  await page.route("**/mock-r2", async (route) =>
    route.fulfill({ status: 200 }),
  );
  await page.route("**/api/workspaces/**/media/complete", async (route) =>
    route.fulfill({
      status: 202,
      json: { inspectionPending: true, asset: uploadedVideo },
    }),
  );
  await page.goto("/post-composer.html");
  await page.getByRole("checkbox", { name: /Tamale Frank/ }).check();
  await page.locator('input[type="file"]').setInputFiles({
    name: "uploaded.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("mock-video"),
  });
  await expect(
    page.getByRole("button", { name: "Check status" }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem("fixture-video-status", "failed"),
  );
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(
    page.getByText("Video verification failed.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish now" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Remove Uploaded video" }).click();
  await expect(
    page.getByText("Video verification failed.", { exact: false }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("unexpected-dispatch")),
  ).toBeNull();
});
