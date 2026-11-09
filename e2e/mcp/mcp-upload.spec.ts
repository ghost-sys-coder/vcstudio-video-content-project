import { test, expect, type Page } from "@playwright/test";
async function open(page: Page, path = "/upload-host.html") {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(path);
  const view = page.frameLocator("iframe");
  await expect(view.getByLabel("Original file")).toBeVisible();
  return { view, requests };
}
const video = {
  name: "original-video.mp4",
  mimeType: "video/mp4",
  buffer: Buffer.alloc(700_000, 7),
};
test("uploads only through MCP Apps tools, checks inspection, and never opens a browser tab or publishes", async ({
  page,
  context,
}) => {
  const { view, requests } = await open(page);
  await view.getByLabel("Original file").setInputFiles(video);
  await view.getByRole("button", { name: "Upload to library" }).click();
  await expect(view.getByText(/Transfer complete/)).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  expect(
    requests.some(
      (url) =>
        url.includes("r2.cloudflarestorage.com") ||
        url.includes("/api/mcp/uploads"),
    ),
  ).toBe(false);
  const calls = await page.locator("body").getAttribute("data-calls");
  expect(JSON.parse(calls ?? "[]")).toEqual([
    "start_media_upload",
    "append_media_upload",
    "append_media_upload",
    "complete_media_upload",
  ]);
  await view.getByRole("button", { name: "Check status" }).click();
  await expect(view.getByText("Media is ready in your library.")).toBeVisible();
  expect(await page.locator("body").getAttribute("data-calls")).not.toMatch(
    /prepare_publication|execute_publication|confirm_publication/,
  );
});
test("interruption preserves one session and resumes missing chunks without restarting", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("upload-fixture-error", "true"),
  );
  const { view } = await open(page);
  await view.getByLabel("Original file").setInputFiles(video);
  await view.getByRole("button", { name: "Upload to library" }).click();
  await expect(view.getByRole("alert")).toContainText("Resume");
  await page.evaluate(() => localStorage.removeItem("upload-fixture-error"));
  await view.getByRole("button", { name: "Resume upload" }).click();
  await expect(view.getByText(/Transfer complete/)).toBeVisible();
  const calls: string[] = JSON.parse(
    (await page.locator("body").getAttribute("data-calls")) ?? "[]",
  );
  expect(calls.filter((name) => name === "start_media_upload")).toHaveLength(1);
  expect(calls).toContain("get_media_upload");
});
test("pauses active transfer, then cancels staging without touching library assets", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("upload-fixture-delay", "true"),
  );
  const { view } = await open(page);
  await view.getByLabel("Original file").setInputFiles(video);
  await view.getByRole("button", { name: "Upload to library" }).click();
  await expect
    .poll(async () => await page.locator("body").getAttribute("data-calls"))
    .toContain("append_media_upload");
  await view.getByRole("button", { name: "Pause upload" }).click();
  await expect(view.getByRole("alert")).toContainText("paused");
  await view.getByRole("button", { name: "Cancel upload" }).click();
  await expect(view.getByText(/Upload cancelled/)).toBeVisible();
  await expect(
    view.getByRole("button", { name: "Upload another file" }),
  ).toBeVisible();
});
test("a different same-size file cannot resume an existing upload", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("upload-fixture-error", "true"),
  );
  const { view } = await open(page);
  await view.getByLabel("Original file").setInputFiles(video);
  await view.getByRole("button", { name: "Upload to library" }).click();
  await expect(view.getByRole("alert")).toBeVisible();
  await view
    .getByLabel("Original file")
    .setInputFiles({ ...video, buffer: Buffer.alloc(700_000, 8) });
  await view.getByRole("button", { name: "Resume upload" }).click();
  await expect(view.getByRole("alert")).toContainText("different file");
});
test("a completed transfer with failed inspection remains visibly unusable", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("upload-fixture-inspection-error", "true"),
  );
  const { view } = await open(page);
  await view.getByLabel("Original file").setInputFiles(video);
  await view.getByRole("button", { name: "Upload to library" }).click();
  await expect(view.getByText(/Transfer complete/)).toBeVisible();
  await view.getByRole("button", { name: "Check status" }).click();
  await expect(view.getByText("Video inspection failed.")).toBeVisible();
});
for (const theme of ["light", "dark"]) {
  test(`upload panel is responsive and keyboard-accessible in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 850 });
    const { view } = await open(page, `/upload-host.html?theme=${theme}`);
    await view.getByLabel("Original file").setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(100),
    });
    await view.getByRole("button", { name: "Upload to library" }).focus();
    await page.keyboard.press("Enter");
    await expect(view.getByText(/Transfer complete/)).toBeVisible();
    expect(
      await page
        .frames()[1]
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `.vercel/mcp-upload-${theme}-phone.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: `.vercel/mcp-upload-${theme}-desktop.png` });
  });
}
