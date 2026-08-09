import { expect, test } from "@playwright/test";

test("an owner can create, edit, and remove a test project", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectName = `E2E project ${marker}`;
  const updatedName = `${projectName} updated`;
  let projectId: string | null = null;

  await page.goto("/app/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page
    .getByLabel("Description")
    .fill("Non-billable Playwright lifecycle fixture.");
  await page.getByLabel("Maximum budget (USD)").fill("0");
  await page.getByRole("button", { name: "Create project" }).click();

  try {
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+\/script$/);
    projectId = new URL(page.url()).pathname.split("/")[3] ?? null;
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { name: projectName }),
    ).toBeVisible();

    await page.goto(`/app/projects/${projectId}/settings`);
    await expect(
      page.getByRole("heading", { name: projectName }),
    ).toBeVisible();
    await page.getByLabel("Name", { exact: true }).fill(updatedName);
    await page
      .getByLabel("Description", { exact: true })
      .fill("Updated by the non-billable Playwright lifecycle test.");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Project settings updated.",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: updatedName }),
    ).toBeVisible();
  } finally {
    if (projectId) {
      await page.goto(`/app/projects/${projectId}/settings`);
      await page.getByRole("button", { name: /^Delete project / }).click();
      await Promise.all([
        page.waitForURL(/\/app\/projects(?:\?.*)?$/, { timeout: 30_000 }),
        page
          .getByRole("dialog")
          .getByRole("button", { name: "Delete project" })
          .click(),
      ]);
      await expect(
        page.getByRole("heading", { name: updatedName }),
      ).toHaveCount(0);
    }
  }
});
