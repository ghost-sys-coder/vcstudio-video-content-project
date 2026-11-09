import { expect, test } from "@playwright/test";

const pageId = "1025029520688408";
const foundPage = {
  externalAccountId: pageId,
  externalAccountName: "VeilCode Studio",
};

for (const theme of ["light", "dark"])
  for (const width of [390, 1440]) {
    test(`missing Facebook Page can be verified then connected in ${theme} at ${width}px`, async ({
      page,
    }, info) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let lookups = 0;
      let connections = 0;
      await page.route("**/test-facebook-find", async (route) => {
        lookups++;
        expect(route.request().postData()).toContain(pageId);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.fulfill({ json: { page: foundPage, error: null } });
      });
      await page.route("**/test-facebook-connect", async (route) => {
        connections++;
        expect(route.request().postData()).toContain(pageId);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await route.fulfill({ json: { ok: true } });
      });
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/facebook-selection.html");
      await page.evaluate(
        (value) =>
          document.documentElement.classList.toggle("dark", value === "dark"),
        theme,
      );
      await expect(page.getByText("Clear Work", { exact: true })).toBeVisible();
      const input = page.getByLabel("Facebook Page ID", { exact: true });
      await input.fill(pageId);
      await input.press("Enter");
      await expect(
        page.getByRole("button", { name: "Checking Facebook…" }),
      ).toBeDisabled();
      const result = page.getByRole("region", { name: "Missing a Page?" });
      await expect(
        page.getByText("VeilCode Studio", { exact: true }),
      ).toBeVisible();
      await expect(input).toHaveValue(pageId);
      const inputBox = await input.boundingBox();
      const findBox = await page
        .getByRole("button", { name: "Find Page", exact: true })
        .boundingBox();
      expect(inputBox?.height).toBe(40);
      expect(findBox?.height).toBe(40);
      expect(connections).toBe(0);
      expect(lookups).toBe(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("facebook-page-found.png"),
        fullPage: true,
      });
      await result
        .getByRole("button", { name: "Connect Page", exact: true })
        .click();
      await expect(
        result.getByRole("button", { name: "Connecting…" }),
      ).toBeDisabled();
      await expect(
        page.getByRole("heading", { name: "Facebook Page connected" }),
      ).toBeVisible();
      expect(connections).toBe(1);
      expect(errors).toEqual([]);
    });
  }

test("permission failure retains Page ID and offers reconnection without saving", async ({
  page,
}) => {
  let connections = 0;
  await page.route("**/test-facebook-connect", async (route) => {
    connections++;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/test-facebook-find", (route) =>
    route.fulfill({
      json: {
        page: null,
        error:
          "Facebook did not grant access to this Page. Select it in Edit settings and reconnect.",
      },
    }),
  );
  await page.goto("/facebook-selection.html");
  await page.getByLabel("Facebook Page ID", { exact: true }).fill(pageId);
  await page.getByRole("button", { name: "Find Page", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Edit settings");
  await expect(
    page.getByLabel("Facebook Page ID", { exact: true }),
  ).toHaveValue(pageId);
  await expect(
    page.getByRole("link", {
      name: "Reconnect to review Facebook permissions",
    }),
  ).toHaveAttribute("href", "/api/facebook/authorize");
  expect(connections).toBe(0);
});

test("transport failure retains the ID and supports a successful retry", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/test-facebook-find", async (route) => {
    attempts++;
    if (attempts === 1)
      await route.fulfill({ status: 503, body: "Unavailable" });
    else await route.fulfill({ json: { page: foundPage, error: null } });
  });
  await page.goto("/facebook-selection.html");
  const input = page.getByLabel("Facebook Page ID", { exact: true });
  await input.fill(pageId);
  await page.getByRole("button", { name: "Find Page", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("try again");
  await expect(input).toHaveValue(pageId);
  await page.getByRole("button", { name: "Find Page", exact: true }).click();
  await expect(
    page.getByText("VeilCode Studio", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(attempts).toBe(2);
});
