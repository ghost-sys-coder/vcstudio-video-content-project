import { expect, test } from "@playwright/test";

/**
 * Verifies the pacing picker without spending money: no script, no scenes, no
 * generation. The profile is a project setting, so it can be read and changed
 * on an empty project, and that is deliberately all this touches.
 *
 * What it cannot check is the consequence. Whether a Short actually cuts where
 * the narration pauses needs a rendered video, which needs narration audio and
 * therefore real spend — left to a manual walkthrough rather than smuggled into
 * a test that looks free.
 */
test("a project's pacing can be read and changed from the render workspace", async ({
  page,
}) => {
  test.setTimeout(120_000);
  let projectId: string | null = null;

  await page.goto("/app/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(`Pacing E2E ${Date.now()}`);
  await page.getByLabel("Maximum budget (USD)").fill("0");
  await page.getByRole("button", { name: "Create project" }).click();

  try {
    // Generous: a dev server compiles each route on first visit, and the
    // creation redirect waits on that rather than on anything this test does.
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+\/script$/, {
      timeout: 60_000,
    });
    projectId = new URL(page.url()).pathname.split("/")[3] ?? null;

    await page.goto(`/app/projects/${projectId}/render`);

    const pacing = page.getByRole("region", { name: "Pacing" }).or(
      page.locator("section").filter({ hasText: "Pacing" }).first(),
    );
    await expect(
      page.getByRole("heading", { name: "Pacing", exact: true }),
    ).toBeVisible({ timeout: 60_000 });

    // Every profile is offered, not just the one in use.
    for (const label of ["Documentary", "Explainer", "Short"])
      await expect(pacing.getByText(label, { exact: true })).toBeVisible();

    // A new project starts on the profile that reproduces the historical
    // behaviour, which is the whole backwards-compatibility promise.
    const explainer = page.getByRole("radio", { name: /Explainer/ });
    await expect(explainer).toBeChecked();

    // Nothing to save until something changes.
    const save = page.getByRole("button", { name: "Save pacing" });
    await expect(save).toBeDisabled();

    await page.getByRole("radio", { name: /Short/ }).check();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(
      page.getByText("Saved. The next render uses this pace."),
    ).toBeVisible();

    // The choice has to survive a reload, or it was never written.
    await page.reload();
    await expect(page.getByRole("radio", { name: /Short/ })).toBeChecked();
  } finally {
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
