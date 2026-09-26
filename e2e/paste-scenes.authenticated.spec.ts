import { expect, test } from "@playwright/test";

/**
 * Two regressions that only a real browser and a real database can catch.
 *
 * **Pasting into a project with no script or AI run.**
 * `scenes.script_version_id` and `analysis_run_id` were still `NOT NULL` in the
 * database while the schema and every command had moved to nullable, so a
 * manual scene with no analysis run to inherit violated the constraint. A
 * project that already had scenes always had a completed run to borrow, which
 * is why it failed only on new projects, and why no unit test could see it.
 *
 * **Selecting a scene afterwards.** `applyState` wrote browser history from
 * inside a `setState` updater, using the updater as a getter. React may run an
 * updater during a render and Next patches the history methods, so the router
 * was updated mid-render — a development-time console warning invisible to
 * every unit test and to a production build.
 *
 * The project is created here rather than named, so the test cannot rot when a
 * fixture project is deleted. Deliberately free: manual scenes start no
 * generation.
 */
test("scenes can be pasted into a new project, then selected cleanly", async ({
  page,
}) => {
  test.setTimeout(240_000);
  let projectId: string | null = null;

  const routerErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Cannot update a component|setState\(\) call inside/i.test(text))
      routerErrors.push(text);
  });

  await page.goto("/app/projects");
  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(`Paste E2E ${Date.now()}`);
  await page.getByLabel("Maximum budget (USD)").fill("0");
  await page.getByRole("button", { name: "Create project" }).click();

  try {
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]+\/script$/, {
      timeout: 90_000,
    });
    projectId = new URL(page.url()).pathname.split("/")[3] ?? null;

    // Straight to scenes: no script approved, no analysis ever run.
    await page.goto(`/app/projects/${projectId}/scenes`);
    await page
      .getByRole("button", { name: "Paste scenes" })
      .click({ timeout: 90_000 });

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

    const navigator = page.getByRole("complementary", {
      name: "Scene navigator",
    });
    await expect(navigator).toBeVisible({ timeout: 90_000 });
    await expect(
      navigator.getByRole("button", { name: /Scene 2\b/ }),
    ).toBeVisible();

    // Selecting must move the address bar without updating the router mid-render.
    await navigator.getByRole("button", { name: /Scene 2\b/ }).click();
    await expect(page).toHaveURL(/scene=2/, { timeout: 30_000 });
    await navigator.getByRole("button", { name: /Scene 1\b/ }).click();
    await expect(page).toHaveURL(/scene=1/, { timeout: 30_000 });

    expect(routerErrors).toEqual([]);
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
