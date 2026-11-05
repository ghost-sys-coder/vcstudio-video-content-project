import { expect, test } from "@playwright/test";
import {
  draftKey,
  libraryImage,
  libraryPageAssets,
  uploadedImage,
  uploadedVideo,
} from "./fixtures/social-draft-data";

test("attach from library, save and reload retains the chosen file", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/post-composer.html");
  await page.getByRole("button", { name: "Attach media" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Library image one/ }).click();
  await expect(
    dialog.getByText("1 file selected", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Save to post (1)", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBeNull();
  await dialog
    .getByRole("button", { name: "Save to post (1)", exact: true })
    .click();
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
  await expect(page.getByText("Media saved to this post.")).toBeVisible();
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
  await page.evaluate(() => localStorage.setItem("fixture-save-error", "true"));
  await dialog
    .getByRole("button", { name: "Save to post (1)", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Your changes are still here",
  );
  await expect(
    dialog.getByRole("button", { name: "Library image one", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBeNull();
  await page.evaluate(() => localStorage.removeItem("fixture-save-error"));
  await dialog
    .getByRole("button", { name: "Save to post (1)", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(/Saved at/)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Library image one" }),
  ).toBeVisible();
});

for (const theme of ["light", "dark"]) {
  test(`a full library keeps save visible on a short ${theme} viewport and preserves the whole draft`, async ({
    page,
  }) => {
    await page.setViewportSize(
      theme === "dark"
        ? { width: 1280, height: 520 }
        : { width: 390, height: 480 },
    );
    await page.goto("/post-composer.html");
    await page.evaluate(
      (value) =>
        document.documentElement.classList.toggle("dark", value === "dark"),
      theme,
    );
    await page.getByLabel("Internal name").fill("Library attachment test");
    await page
      .getByLabel("Post body")
      .fill("My current draft text stays with these images.");
    await page.getByRole("checkbox", { name: /Tamale Frank/ }).check();
    await page.evaluate(() =>
      localStorage.setItem("fixture-save-delay", "1200"),
    );
    await page
      .getByRole("button", { name: "Attach media", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: /^Library image/ }),
    ).toHaveCount(24);
    await dialog
      .getByRole("button", { name: "Library image one", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Library image 24", exact: true })
      .scrollIntoViewIfNeeded();
    await dialog
      .getByRole("button", { name: "Library image 24", exact: true })
      .click();
    const save = dialog.getByRole("button", {
      name: "Save to post (2)",
      exact: true,
    });
    await expect(save).toBeInViewport({ ratio: 1 });
    await expect(
      dialog.getByText("2 files selected", { exact: true }),
    ).toBeVisible();
    await save.focus();
    await page.keyboard.press("Enter");
    await expect(
      dialog.getByRole("button", { name: "Saving…", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Media saved to this post.")).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("fixture-save-count")),
    ).toBe("1");
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
      draftKey,
    );
    expect(saved.attachmentIds).toEqual([
      libraryImage.id,
      libraryPageAssets[23].id,
    ]);
    await page.reload();
    await expect(page.getByLabel("Internal name")).toHaveValue(
      "Library attachment test",
    );
    await expect(page.getByLabel("Post body")).toHaveText(
      "My current draft text stays with these images.",
    );
    await expect(
      page.getByRole("checkbox", { name: /Tamale Frank/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", {
        name: "Remove Library image one",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Remove Library image 24",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Attach media", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: /^Library image/ }),
    ).toHaveCount(22);
    await expect(
      dialog.getByRole("button", { name: "Save to post", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  });
}

test("a rejected save retains selection and cancelling does not attach it", async ({
  page,
}) => {
  await page.goto("/post-composer.html");
  await page.evaluate(() =>
    localStorage.setItem("fixture-save-conflict", "true"),
  );
  await page.getByRole("button", { name: "Attach media", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Library image one", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save to post (1)", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "This post changed in another tab",
  );
  await expect(
    dialog.getByRole("button", { name: "Library image one", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Library image one", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), draftKey),
  ).toBeNull();
});

test("an upload finishing during a library save remains attached for the next save", async ({
  page,
}) => {
  let finishUpload: (() => void) | undefined;
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
  await page.route("**/api/workspaces/**/media/complete", async (route) => {
    await new Promise<void>((resolve) => {
      finishUpload = resolve;
    });
    await route.fulfill({ json: { asset: uploadedImage } });
  });
  await page.goto("/post-composer.html");
  await page.evaluate(() => localStorage.setItem("fixture-save-delay", "1200"));
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "uploaded.png",
      mimeType: "image/png",
      buffer: Buffer.from("mock-image"),
    });
  await expect.poll(() => Boolean(finishUpload)).toBe(true);
  await page.getByRole("button", { name: "Attach media", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Library image one", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save to post (1)", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  finishUpload?.();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove Library image one", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Uploaded image", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Media changes are ready. Save the draft to keep them."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save draft changes", exact: true })
    .click();
  await expect(page.getByText("Media saved to this post.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove Library image one", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove Uploaded image", exact: true }),
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
