import { expect, test } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`saved draft destinations survive refresh and explicit clearing in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/post-composer.html?theme=${theme}`);
    const personal = page.getByRole("checkbox", { name: /Tamale Frank/ });
    const business = page.getByRole("checkbox", { name: /Business page/ });
    await expect(personal).not.toBeChecked();
    await personal.check();
    await expect(
      page.getByRole("button", { name: "Publish now" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved at/)).toBeVisible();
    await page.reload();
    await expect(personal).toBeChecked();
    await expect(business).not.toBeChecked();
    await personal.uncheck();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Saved at/)).toBeVisible();
    await page.reload();
    await expect(personal).not.toBeChecked();
    expect(
      await page.evaluate(() => localStorage.getItem("unexpected-dispatch")),
    ).toBeNull();
  });
  test(`MCP-selected personal account is checked after reload in ${theme}`, async ({
    page,
  }) => {
    await page.goto(`/post-composer.html?theme=${theme}&mcp=1`);
    await expect(
      page.getByRole("checkbox", { name: /Tamale Frank/ }),
    ).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: /Business page/ }),
    ).not.toBeChecked();
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: /Tamale Frank/ }),
    ).toBeChecked();
    expect(
      await page.evaluate(() => localStorage.getItem("unexpected-dispatch")),
    ).toBeNull();
  });
}
