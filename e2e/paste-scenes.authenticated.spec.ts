import { expect, test } from "@playwright/test";

/**
 * Pasting scenes into a project that has never had a script or an AI run.
 *
 * This is the case that broke: `scenes.script_version_id` and
 * `analysis_run_id` were still `NOT NULL` in the database while the schema and
 * every command had already moved to nullable, so a manual scene with no
 * analysis run to inherit violated the constraint. A project that already had
 * scenes always had a completed run to borrow, which is why it only failed on
 * new projects — and why no unit test could catch it. The guard has to run
 * against a real database.
 *
 * Deliberately free: a manual scene starts no generation.
 */
test("a scene can be pasted into a project with no script and no scenes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  let projectId: string | null = null;

  await page.goto("/app/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(`Paste E2E ${Date.now()}`);
  await page.getByLabel("Maximum budget (USD)").fill("0");
  await page.getByRole("button", { name: "Create project" }).click();

  try {
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+\/script$/, {
      timeout: 60_000,
    });
    projectId = new URL(page.url()).pathname.split("/")[3] ?? null;

    // Straight to scenes, with no script approved and no analysis ever run.
    await page.goto(`/app/projects/${projectId}/scenes`);
    await page
      .getByRole("button", { name: "Paste scenes" })
      .click({ timeout: 60_000 });

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Scene JSON").fill(
      JSON.stringify([
        {
          narrationText: "You work forty hours a week and still feel poorer.",
          visualDescription: "A stick figure walks a treadmill labelled work.",
          locationDescription: "An abstract whiteboard environment.",
          actionDescription: "Dollar signs drift out of a wallet into a vault.",
          cameraShot: "Wide shot",
          cameraAngle: "Eye level",
          cameraMotion: "Static with a slow pan right",
          emotionalTone: "Curious and tense",
          characterNames: ["Stickman Alex"],
          propNames: ["Treadmill", "Wallet"],
          continuityNotes: "Alex always wears a bright blue tie.",
          estimatedDurationMilliseconds: 30_000,
        },
        {
          narrationText: "The missing piece is built into the system itself.",
          visualDescription: "A hand draws a vault labelled the system.",
          locationDescription: "An abstract whiteboard environment.",
          actionDescription: "A magnifying glass zooms into the vault.",
          cameraShot: "Medium shot",
          cameraAngle: "Eye level",
          cameraMotion: "Push in",
          emotionalTone: "Revealing",
          characterNames: [],
          propNames: ["Vault"],
          continuityNotes: "",
          estimatedDurationMilliseconds: 20_000,
        },
      ]),
    );

    await dialog.getByRole("button", { name: "Add scenes" }).click();

    // Both scenes exist, numbered from one, on a project with no analysis run.
    await expect(page).toHaveURL(
      new RegExp(`/app/projects/${projectId}/scenes`),
      { timeout: 60_000 },
    );
    await expect(
      page.getByRole("button", { name: /Scene 1/ }).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(
      page.getByRole("button", { name: /Scene 2/ }).first(),
    ).toBeVisible();
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
