import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { mediaOrigin } from "./fixtures/data";
for (const theme of ["light", "dark"]) {
  test(`private image is visible under the exact media CSP in ${theme} mode`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const png = await sharp({
      create: {
        width: 3,
        height: 5,
        channels: 3,
        background: "#80a060",
      },
    })
      .png()
      .toBuffer();
    await page.route(`${mediaOrigin}/**`, async (route) => {
      await route.fulfill({ contentType: "image/png", body: png });
    });
    await page.route("**/review.html", async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "content-security-policy": `img-src ${mediaOrigin}`,
        },
      });
    });
    let untrustedRequests = 0;
    await page.route("https://untrusted.example/**", async (route) => {
      untrustedRequests++;
      await route.abort();
    });
    await page.goto(`/host.html?withMedia=1&theme=${theme}`);
    const review = page.frameLocator("iframe");
    const image = review.getByRole("img", { name: "Imported portrait" });
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (el: HTMLImageElement) =>
            el.complete && el.naturalWidth === 3 && el.naturalHeight === 5,
        ),
      )
      .toBe(true);
    await expect(image).toHaveCSS("object-fit", "contain");
    expect(
      await review
        .locator("html")
        .evaluate((el) => el.scrollWidth <= innerWidth),
    ).toBe(true);
    expect(
      await review.locator("body").evaluate(async (body) => {
        const blocked = document.createElement("img");
        const finished = new Promise<boolean>((resolve) => {
          blocked.onerror = () => resolve(blocked.naturalWidth === 0);
          blocked.onload = () => resolve(false);
        });
        blocked.src = "https://untrusted.example/blocked.png";
        body.append(blocked);
        return finished;
      }),
    ).toBe(true);
    expect(untrustedRequests).toBe(0);
    await expect(page.locator("body")).not.toHaveAttribute("data-approvals");
  });
}
for (const theme of ["light", "dark"]) {
  test(`interactive ${theme} review on a narrow display requires an explicit human click`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/host.html?theme=${theme}`);
    const review = page.frameLocator("iframe");
    await expect(
      review.getByRole("heading", { name: "Review scheduled publication" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toHaveAttribute("data-approvals");
    await expect(review.locator("html")).toHaveClass(
      theme === "dark" ? /dark/ : /^$/,
    );
    await expect(
      review.getByText("Africa/Kampala", { exact: false }),
    ).toBeVisible();
    expect(
      await review
        .locator("html")
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const button = review.getByRole("button", { name: "Approve schedule" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("body")).toHaveAttribute("data-approvals", "1");
    await expect(button).toBeDisabled();
  });
}
test("reloaded or unsupported proof delivery provides the browser review fallback", async ({
  page,
}) => {
  await page.goto("/host.html?noProof=1");
  const review = page.frameLocator("iframe");
  await expect(
    review.getByRole("button", { name: "Approve schedule" }),
  ).toBeDisabled();
  await expect(
    review.getByRole("link", { name: "Review in VCStudio" }),
  ).toHaveAttribute(
    "href",
    /https:\/\/vcstudio.example\/app\/mcp\/operations\//,
  );
});
test("upload handoff preserves selection after interruption and can complete safely", async ({
  page,
}) => {
  let puts = 0;
  await page.route("**/api/mcp/uploads/**", async (route) =>
    route.fulfill({
      json:
        route.request().postDataJSON().step === "authorize"
          ? { uploadUrl: "http://127.0.0.1:38173/private-upload" }
          : { ok: true },
    }),
  );
  await page.route("**/private-upload", async (route) =>
    route.fulfill({ status: ++puts === 1 ? 503 : 200 }),
  );
  await page.goto("/harness.html?mode=upload");
  await page.getByLabel("Image or video").setInputFiles({
    name: "existing.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "mocked upload bytes; server decoding is tested separately",
    ),
  });
  await page.getByRole("button", { name: "Upload to workspace" }).click();
  await expect(page.getByRole("status")).toContainText("interrupted");
  expect(
    await page
      .getByLabel("Image or video")
      .evaluate((el: HTMLInputElement) => el.files?.length),
  ).toBe(1);
  await page.getByRole("button", { name: "Upload to workspace" }).click();
  await expect(page.getByRole("status")).toContainText("Upload saved");
});
test("workspace grants and revocation confirmation are usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/harness.html");
  await expect(
    page.getByRole("heading", { name: "AI connections" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Disconnect AI connection" }).click();
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
});
test("signed-in browser review uses a deliberate approval action", async ({
  page,
}) => {
  await page.goto("/harness.html?mode=approval");
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Approve schedule" }).click();
  await expect(page.getByRole("status")).toContainText("Approval recorded");
});
