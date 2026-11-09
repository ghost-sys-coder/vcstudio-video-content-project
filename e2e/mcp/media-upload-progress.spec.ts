import { expect, test } from "@playwright/test";
import { uploadedImage, uploadedVideo } from "./fixtures/social-draft-data";

for (const theme of ["light", "dark"] as const) {
  test(`a slow ${theme} video upload shows actual bytes and a separate finalization state`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.setViewportSize(
      theme === "dark"
        ? { width: 320, height: 760 }
        : { width: 1280, height: 900 },
    );
    let authorize: () => Promise<void> = async () => {
      throw new Error("authorization not requested");
    };
    let complete: () => Promise<void> = async () => {
      throw new Error("completion not requested");
    };
    await page.route("**/api/workspaces/**/media/upload", async (route) => {
      authorize = () =>
        route.fulfill({
          json: {
            mediaAssetId: uploadedVideo.id,
            objectKey: "fixture",
            uploadUrl: "http://127.0.0.1:38173/test-media-storage",
          },
        });
    });
    await page.route("**/api/workspaces/**/media/complete", async (route) => {
      complete = () =>
        route.fulfill({
          status: 202,
          json: { inspectionPending: true, asset: uploadedVideo },
        });
    });
    await page.goto(`/media-upload.html?theme=${theme}`);
    const session = await page.context().newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: 128 * 1024,
    });
    const name = `My-business-channel-video-${"long-name-".repeat(12)}.mp4`;
    await page.locator('input[type="file"]').setInputFiles({
      name,
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1024 * 1024, 1),
    });
    const panel = page.getByRole("region", { name: "File upload progress" });
    const bar = panel.getByRole("progressbar");
    await expect(panel.getByText("Preparing file 1 of 1")).toBeVisible();
    await expect(bar).not.toHaveAttribute("aria-valuenow");
    await expect(
      page.getByRole("button", { name: "Upload in progress" }),
    ).toBeDisabled();
    await expect(page.locator('input[type="file"]')).toBeDisabled();
    await authorize();
    await expect(panel.getByText("Uploading file 1 of 1")).toBeVisible();
    await expect
      .poll(async () => Number(await bar.getAttribute("aria-valuenow")))
      .toBeGreaterThan(0);
    const percentage = Number(await bar.getAttribute("aria-valuenow"));
    expect(percentage).toBeLessThan(100);
    await expect(panel.getByText(name, { exact: true })).toBeVisible();
    await expect(panel.getByText(/of 1 MB/)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.vercel/media-upload-progress-${theme}.png`,
      fullPage: true,
    });
    await expect(panel.getByText("Finishing file 1 of 1")).toBeVisible({
      timeout: 20000,
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "100");
    await expect(bar).toHaveAttribute(
      "aria-valuetext",
      "File transferred; finishing upload",
    );
    await expect(panel.getByText("100% transferred")).toBeVisible();
    await expect(
      page.getByText("1 file uploaded.", { exact: true }),
    ).toHaveCount(0);
    await complete();
    await expect(panel).toHaveCount(0);
    await expect(
      page.getByText("1 file uploaded.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/being verified/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Choose files" }),
    ).toBeEnabled();
    await session.detach();
  });
}

test("a failed storage upload resets progress and permits selecting the same file again", async ({
  page,
}) => {
  let rejectStorage = true;
  let completionCount = 0;
  await page.route("**/api/workspaces/**/media/upload", async (route) =>
    route.fulfill({
      json: {
        mediaAssetId: uploadedImage.id,
        objectKey: "fixture",
        uploadUrl: "http://127.0.0.1:38173/mock-progress-storage",
      },
    }),
  );
  await page.route("**/mock-progress-storage", async (route) =>
    route.fulfill({ status: rejectStorage ? 403 : 200 }),
  );
  await page.route("**/api/workspaces/**/media/complete", async (route) => {
    completionCount += 1;
    await route.fulfill({ json: { asset: uploadedImage } });
  });
  await page.goto("/media-upload.html");
  const file = {
    name: "my-image.png",
    mimeType: "image/png",
    buffer: Buffer.from("mock image"),
  };
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(
    page.getByText(/rejected the upload \(HTTP 403\)/),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Choose files" }),
  ).toBeEnabled();
  expect(completionCount).toBe(0);
  rejectStorage = false;
  await page.locator('input[type="file"]').setInputFiles(file);
  await expect(
    page.getByText("1 file uploaded.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Uploaded image", { exact: true })).toBeVisible();
  await expect(page.getByText(/rejected the upload/)).toHaveCount(0);
  expect(completionCount).toBe(1);
});

test("a batch advances to the next file after failure without losing the successful uploads", async ({
  page,
}) => {
  let uploadIndex = 0;
  let finishSecond: () => Promise<void> = async () => {
    throw new Error("second storage request missing");
  };
  await page.route("**/api/workspaces/**/media/upload", async (route) => {
    uploadIndex += 1;
    await route.fulfill({
      json: {
        mediaAssetId: `asset-${uploadIndex}`,
        objectKey: `fixture-${uploadIndex}`,
        uploadUrl: `http://127.0.0.1:38173/batch-storage-${uploadIndex}`,
      },
    });
  });
  await page.route("**/batch-storage-*", async (route) => {
    if (route.request().url().endsWith("-2"))
      finishSecond = () => route.fulfill({ status: 503 });
    else await route.fulfill({ status: 200 });
  });
  await page.route("**/api/workspaces/**/media/complete", async (route) => {
    const body: unknown = route.request().postDataJSON();
    const id =
      typeof body === "object" && body && "mediaAssetId" in body
        ? String(body.mediaAssetId)
        : "missing";
    await route.fulfill({
      json: { asset: { ...uploadedImage, id, title: `Successful ${id}` } },
    });
  });
  await page.goto("/media-upload.html");
  await page.locator('input[type="file"]').setInputFiles(
    [1, 2, 3].map((index) => ({
      name: `file-${index}.png`,
      mimeType: "image/png",
      buffer: Buffer.from(`image ${index}`),
    })),
  );
  await expect(
    page.getByText("Uploading file 2 of 3", { exact: true }),
  ).toBeVisible();
  await finishSecond();
  await expect(
    page.getByText("2 files uploaded.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/rejected the upload \(HTTP 503\)/),
  ).toBeVisible();
  await expect(
    page.getByText("Successful asset-1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Successful asset-3", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});
