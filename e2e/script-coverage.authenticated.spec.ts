import { expect, test } from "@playwright/test";

/**
 * Verifies the V2-03 review surface without spending money: no scene analysis
 * is started, so this asserts the states a creator sees around the coverage
 * panel rather than a generated plan. A faithful-plan assertion needs a real
 * analysis run and is deliberately left to the manual walkthrough.
 */
test("the scenes page exposes script coverage state without billable work", async ({
  page,
}) => {
  test.setTimeout(120_000);
  let projectId: string | null = null;
  await page.goto("/app/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page
    .getByLabel("Project name")
    .fill(`Script coverage E2E ${Date.now()}`);
  await page.getByLabel("Maximum budget (USD)").fill("0");
  await page.getByRole("button", { name: "Create project" }).click();
  try {
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+\/script$/);
    projectId = new URL(page.url()).pathname.split("/")[3] ?? null;

    // Before an approved script there is nothing to compare, so the panel must
    // stay hidden rather than claim a problem.
    await page.goto(`/app/projects/${projectId}/scenes`);
    await expect(
      page.getByText("Compare scene narration to the approved script"),
    ).toHaveCount(0);

    const script = page.getByRole("textbox", {
      name: "Narration script",
      exact: true,
    });
    await page.goto(`/app/projects/${projectId}/script`);
    await script.fill(
      "Compound interest is quiet at first. Then it is not. Start early.",
    );
    await expect(
      page.getByText("All changes saved.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Save and approve|Approve script/ })
      .click();
    await expect(
      page.getByText("Script saved and approved for production.", {
        exact: true,
      }),
    ).toBeVisible();

    // An approved script with no scenes still must not render a false verdict.
    await page.goto(`/app/projects/${projectId}/scenes`);
    await expect(
      page.getByText("Compare scene narration to the approved script"),
    ).toHaveCount(0);
    await expect(
      page.getByText("Scene narration does not match the approved script"),
    ).toHaveCount(0);
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
