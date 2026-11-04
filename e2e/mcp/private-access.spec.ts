import { test, expect } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`public waitlist ${theme} layout submits once and shows confirmation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/waitlist.html?theme=${theme}`);
    await expect(
      page.getByRole("heading", {
        name: "We're building something worth waiting for.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Join waitlist" }),
    ).toHaveAttribute("href", "/waitlist");
    await expect(
      page.getByRole("link", { name: "Create account" }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByLabel("Email address").fill("Test.Owner@Example.com");
    await page
      .locator("form")
      .getByRole("button", { name: "Join waitlist" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "You're on the waitlist",
    );
    await expect(page.locator("body")).toHaveAttribute("data-submissions", "1");
    await expect(page.locator("body")).toHaveAttribute(
      "data-email",
      "test.owner@example.com",
    );
    await expect(
      page.getByRole("link", { name: "Owner sign in" }),
    ).toHaveAttribute("href", "/sign-in");
  });
}
test("waitlist failure preserves the email and allows retry without provisioning access", async ({
  page,
}) => {
  await page.goto("/waitlist.html?fail=1");
  await page.getByLabel("Email address").fill("person@example.com");
  await page
    .locator("form")
    .getByRole("button", { name: "Join waitlist" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Please try again");
  await expect(page.getByLabel("Email address")).toHaveValue(
    "person@example.com",
  );
  await expect(
    page.locator("form").getByRole("button", { name: "Join waitlist" }),
  ).toBeEnabled();
  await expect(page.getByRole("link", { name: "Open workspace" })).toHaveCount(
    0,
  );
  expect(await page.locator("body").getAttribute("data-submissions")).toBe("1");
});
