import { expect, test } from "@playwright/test";
test("hidden library tabs make no automatic status requests", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/media-library.html");
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    }),
  );
  await page.clock.runFor(30000);
  expect(
    await page.evaluate(() => localStorage.getItem("inspection-check-count")),
  ).toBeNull();
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    }),
  );
  await page.clock.runFor(10000);
  expect(
    Number(
      await page.evaluate(() => localStorage.getItem("inspection-check-count")),
    ),
  ).toBeGreaterThan(0);
});
for (const theme of ["light", "dark"]) {
  test(`pending uploads stay visible and become usable during bounded ${theme} checks`, async ({
    page,
  }) => {
    await page.setViewportSize(
      theme === "dark"
        ? { width: 320, height: 800 }
        : { width: 1280, height: 900 },
    );
    await page.clock.install();
    await page.goto(`/media-library.html?theme=${theme}`);
    const queue = page.getByRole("region", { name: "Upload verification" });
    await expect(
      queue.getByText("Uploaded video", { exact: true }),
    ).toBeVisible();
    await expect(
      queue.getByText("Verifying video", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("The library is empty", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.vercel/video-inspection-${theme}.png`,
      fullPage: true,
    });
    await page.evaluate(() =>
      localStorage.setItem("inspection-result", "ready"),
    );
    await page.clock.runFor(6000);
    await expect(queue).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Uploaded video/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem("inspection-retry-count")),
    ).toBeNull();
  });
}
test("a crashed upload shows a retry action that reuses its saved original", async ({
  page,
}) => {
  await page.goto("/media-library.html?failed");
  const queue = page.getByRole("region", { name: "Upload verification" });
  await expect(
    queue.getByText("Verification failed", { exact: true }),
  ).toBeVisible();
  await expect(queue.getByText(/ran out of memory/)).toBeVisible();
  await queue.getByRole("button", { name: "Retry verification" }).click();
  await expect(
    queue.getByText("Verifying video", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("inspection-retry-count")),
  ).toBe("1");
  await page.evaluate(() => localStorage.setItem("inspection-result", "ready"));
  await queue.getByRole("button", { name: "Check status" }).click();
  await expect(queue).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Uploaded video/ }),
  ).toBeVisible();
});
test("automatic checks stop after two minutes and a failed check preserves the upload", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/media-library.html");
  await page.clock.runFor(125000);
  const count = await page.evaluate(() =>
    localStorage.getItem("inspection-check-count"),
  );
  expect(Number(count)).toBeLessThanOrEqual(12);
  expect(Number(count)).toBeGreaterThan(0);
  await page.clock.runFor(60000);
  expect(
    await page.evaluate(() => localStorage.getItem("inspection-check-count")),
  ).toBe(count);
  await page.evaluate(() =>
    localStorage.setItem("inspection-status-error", "true"),
  );
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await expect(page.getByText("Uploaded video", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    localStorage.removeItem("inspection-status-error");
    localStorage.setItem("inspection-result", "ready");
  });
  await page.getByRole("button", { name: "Check status" }).click();
  await expect(
    page.getByRole("region", { name: "Upload verification" }),
  ).toHaveCount(0);
});
