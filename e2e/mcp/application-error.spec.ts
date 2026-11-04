import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1440]) {
    test(`error retry feedback, failure and recovery in ${theme} at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 950 });
      await page.addInitScript((theme) => {
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.classList.toggle("dark", theme === "dark");
        });
      }, theme);
      let finishRequest: (() => void) | undefined;
      let outcome = "unavailable";
      let requests = 0;
      await page.route("**/__retry-view", async (route) => {
        requests++;
        await new Promise<void>((resolve) => {
          finishRequest = resolve;
        });
        await route.fulfill({
          status: 200,
          contentType: "text/plain",
          body: outcome,
        });
      });
      await page.goto("/application-error.html");
      const retry = page.getByRole("button", {
        name: "Try again",
        exact: true,
      });
      await expect(retry).toBeEnabled();
      await expect(
        page.getByRole("link", { name: "Go to dashboard" }),
      ).toHaveAttribute("href", "/app");
      await retry.focus();
      await page.keyboard.press("Enter");
      const pending = page.getByRole("button", {
        name: "Trying again…",
        exact: true,
      });
      await expect(pending).toBeDisabled();
      await expect(pending).toHaveAttribute("aria-busy", "true");
      await expect(pending.locator("svg")).toBeVisible();
      await expect(page.getByRole("status")).toHaveText("Reloading this view…");
      await pending.evaluate((button: HTMLButtonElement) => button.click());
      await expect.poll(() => requests).toBe(1);
      expect(
        await page.evaluate(() =>
          localStorage.getItem("operationsRefreshCount"),
        ),
      ).toBe("1");
      finishRequest?.();
      await expect(retry).toBeEnabled();
      await expect(page.getByRole("status")).toContainText(
        "This view is still unavailable.",
      );
      await expect(retry).toHaveAttribute("aria-busy", "false");
      outcome = "loaded";
      await retry.click();
      await expect(pending).toBeDisabled();
      await expect.poll(() => requests).toBe(2);
      finishRequest?.();
      await expect(
        page.getByRole("heading", { name: "Workspace view loaded" }),
      ).toBeVisible();
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
}
