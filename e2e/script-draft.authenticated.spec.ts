import { expect, test } from "@playwright/test";

test("script autosave survives reload and reconnect before exact approval", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  let projectId: string | null = null;
  await page.goto("/app/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page
    .getByLabel("Project name")
    .fill(`Script recovery E2E ${Date.now()}`);
  await page.getByLabel("Maximum budget (USD)").fill("0");
  await page.getByRole("button", { name: "Create project" }).click();
  try {
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+\/script$/);
    projectId = new URL(page.url()).pathname.split("/")[3] ?? null;
    const script = page.getByRole("textbox", {
      name: "Narration script",
      exact: true,
    });
    await script.fill("A non-billable narration draft for recovery testing.");
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(script).toHaveValue(
      "A non-billable narration draft for recovery testing.",
    );
    await context.setOffline(true);
    await script.fill(
      "The final narration written during a connection interruption.",
    );
    await expect(
      page.getByRole("alert").filter({
        hasText: /Connection interrupted|could not be saved|timed out/,
      }),
    ).toBeVisible({ timeout: 20_000 });
    await context.setOffline(false);
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await page
      .getByRole("button", {
        name: "Save and approve for production",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Script saved and approved for production.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("Version 1", { exact: true })).toBeVisible();
    await page.reload();
    await expect(script).toHaveValue(
      "The final narration written during a connection interruption.",
    );
  } finally {
    await context.setOffline(false);
    if (projectId) {
      await page.goto(`/app/projects/${projectId}/settings`);
      await page.getByRole("button", { name: /^Delete project / }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete project" })
        .click();
      await expect(page).toHaveURL(/\/app\/projects(?:\?.*)?$/);
    }
  }
});
