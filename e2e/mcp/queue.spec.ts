import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1440]) {
    test(`queue layout and project links in ${theme} at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.setViewportSize({ width, height: 1100 });
      await page.addInitScript(
        (theme) =>
          document.addEventListener("DOMContentLoaded", () =>
            document.documentElement.classList.toggle("dark", theme === "dark"),
          ),
        theme,
      );
      await page.goto("/app/queue");
      await expect(
        page.getByRole("heading", { name: "Production queue", exact: true }),
      ).toBeVisible();
      const summary = page.getByRole("region", { name: "Queue page summary" });
      await expect(summary.locator("dd")).toHaveText(["4", "2", "1"]);
      await expect(
        page.getByRole("combobox", { name: "Release state" }),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "Channel" }),
      ).toBeVisible();
      expect(
        await page
          .getByRole("combobox", { name: "Release state" })
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBe(40);
      const projects = page.getByRole("list", { name: "Production projects" });
      const rows = projects.locator(":scope > li");
      await expect(rows).toHaveCount(4);
      await expect(
        rows
          .first()
          .getByRole("link", { name: "Open the script", exact: true })
          .first(),
      ).toHaveAttribute(
        "href",
        "/app/projects/10000000-0000-4000-8000-000000000001/script",
      );
      await expect(
        rows.nth(1).getByText("Needs attention", { exact: true }),
      ).toBeVisible();
      await expect(
        rows.nth(2).getByText("Rendered", { exact: true }),
      ).toBeVisible();
      await expect(
        rows.nth(3).getByText("Published", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Queue attention" })
          .getByRole("link", { name: "Everything" }),
      ).toHaveAttribute("aria-current", "page");
      await expect(
        page
          .getByRole("navigation", { name: "Queue pagination" })
          .getByRole("button", { name: "Previous" }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `.vercel/queue-${theme}-${width}.png`,
        fullPage: true,
      });
      expect(errors).toEqual([]);
    });
  }
}

test("queue selects preserve other filters, reset pagination and support keyboard navigation", async ({
  page,
}) => {
  await page.goto("/app/queue?page=2");
  await page.getByRole("combobox", { name: "Release state" }).click();
  await page.getByRole("option", { name: "Rendered", exact: true }).click();
  await expect(page).toHaveURL(/release=rendered/);
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  const channel = page.getByRole("combobox", { name: "Channel" });
  await channel.focus();
  await page.keyboard.press("ArrowDown");
  await page
    .getByRole("option", { name: "Studio explainers", exact: true })
    .click();
  await expect(page).toHaveURL(
    /channelProfileId=11111111-1111-4111-8111-111111111111/,
  );
  expect(new URL(page.url()).searchParams.get("release")).toBe("rendered");
  await page
    .getByRole("navigation", { name: "Queue attention" })
    .getByRole("link", { name: "Blocked", exact: true })
    .click();
  await expect(page).toHaveURL(/attention=blocked/);
  expect(new URL(page.url()).searchParams.get("release")).toBe("rendered");
  expect(new URL(page.url()).searchParams.get("channelProfileId")).toBe(
    "11111111-1111-4111-8111-111111111111",
  );
  await expect(
    page.getByRole("heading", { name: "Nothing matches these filters" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Clear filters", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/app\/queue$/);
  await expect(
    page
      .getByRole("list", { name: "Production projects" })
      .locator(":scope > li"),
  ).toHaveCount(4);
});

test("an empty filtered page keeps pagination to later matches", async ({
  page,
}) => {
  await page.goto("/app/queue?release=scheduled");
  await expect(
    page.getByRole("heading", { name: "Nothing matches these filters" }),
  ).toBeVisible();
  await expect(
    page.getByText("Readiness and release filters apply within each page.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Queue pagination" })
    .getByRole("link", { name: "Next", exact: true })
    .click();
  await expect(page).toHaveURL(/release=scheduled.*page=2/);
  await expect(
    page.getByRole("heading", { name: "A planned November release" }),
  ).toBeVisible();
  await expect(page.getByText("Nov 11, 2026", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Queue pagination" })
      .getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
});

test("empty workspace and out-of-range page have distinct recovery", async ({
  page,
}) => {
  await page.goto("/app/queue?state=empty");
  await expect(
    page.getByRole("heading", { name: "No videos in production" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to projects", exact: true }),
  ).toHaveAttribute("href", "/app/projects");
  await expect(
    page.getByRole("region", { name: "Queue page summary" }).locator("dd"),
  ).toHaveText(["0", "0", "0"]);
  await page.goto("/app/queue?page=3");
  await expect(
    page.getByRole("heading", { name: "No projects on this page" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Back to first page", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\/queue$/);
  await expect(
    page
      .getByRole("list", { name: "Production projects" })
      .locator(":scope > li"),
  ).toHaveCount(4);
});

test("long channel selection stays within a small viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 950 });
  await page.goto(
    "/app/queue?channelProfileId=22222222-2222-4222-8222-222222222222",
  );
  const channel = page.getByRole("combobox", { name: "Channel" });
  await expect(channel).toContainText(
    "Creator notes and practical lessons from the production workspace",
  );
  await channel.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(channel).toBeFocused();
});

test("an unavailable channel remains clearable without exposing channel details", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    "/app/queue?channelProfileId=99999999-9999-4999-8999-999999999999",
  );
  await expect(page.getByRole("combobox", { name: "Channel" })).toContainText(
    "Unavailable channel",
  );
  await expect(
    page.getByRole("heading", { name: "Nothing matches these filters" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Clear filters", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("list", { name: "Production projects" })
      .locator(":scope > li"),
  ).toHaveCount(4);
  expect(errors).toEqual([]);
});
