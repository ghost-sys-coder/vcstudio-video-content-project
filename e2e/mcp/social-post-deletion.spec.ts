import { expect, test, type Page } from "@playwright/test";
const postId = "33333333-3333-4333-8333-333333333333";
const preview = {
  postId,
  name: "Saved destination test",
  version: 3,
  status: "draft",
  mediaCount: 1,
  removableMediaCount: 1,
  canDelete: true,
};
async function loadPreview(page: Page, details = preview) {
  await page.route("**/test-post-deletion-preview?*", (route) =>
    route.fulfill({ json: { ok: true, preview: details } }),
  );
}
async function open(page: Page, path = "/post-composer.html") {
  await page.goto(path);
  await page
    .getByRole("button", {
      name: "Delete post Saved destination test",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Delete post", exact: true }),
  ).toBeEnabled();
  return dialog;
}
test("opening and cancelling a text-only post never deletes it; keyboard focus starts on Cancel", async ({
  page,
}) => {
  let deletions = 0;
  await loadPreview(page, {
    ...preview,
    mediaCount: 0,
    removableMediaCount: 0,
  });
  await page.route("**/test-delete-post", (route) => {
    deletions++;
    return route.fulfill({ json: { ok: true, removedMediaCount: 0 } });
  });
  const dialog = await open(page);
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(deletions).toBe(0);
});
test("keeping media is the default and deleting in the composer returns to all posts", async ({
  page,
}) => {
  await loadPreview(page);
  let payload: unknown;
  await page.route("**/test-delete-post", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, removedMediaCount: 0 } });
  });
  const dialog = await open(page);
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await dialog
    .getByRole("button", { name: "Delete post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(payload).toEqual({
    postId,
    expectedVersion: "3",
    deleteMedia: "false",
  });
  expect(
    await page.evaluate(() => localStorage.getItem("fixture-redirect")),
  ).toBe("/app/social/posts");
});
test("a published card offers confirmation, explains remote copies remain, and sends explicit media removal", async ({
  page,
}) => {
  await loadPreview(page, { ...preview, status: "published" });
  let payload: unknown;
  await page.route("**/test-delete-post", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, removedMediaCount: 1 } });
  });
  const dialog = await open(page, "/post-composer.html?delete-card");
  await expect(dialog).toContainText(
    "Copies already published on social channels will remain there.",
  );
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Delete post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(payload).toMatchObject({ deleteMedia: "true" });
  expect(
    await page.evaluate(() => localStorage.getItem("fixture-refresh")),
  ).toBe("true");
});
test("pending deletion prevents duplicate submission, Escape and cancellation", async ({
  page,
}) => {
  await loadPreview(page);
  let deletions = 0;
  let release: () => void = () => {};
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/test-delete-post", async (route) => {
    deletions++;
    await blocked;
    await route.fulfill({ json: { ok: true, removedMediaCount: 0 } });
  });
  const dialog = await open(page);
  await dialog
    .getByRole("button", { name: "Delete post", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Deleting...", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(deletions).toBe(1);
  release();
  await expect(dialog).toHaveCount(0);
});
test("a recoverable failure preserves media choice and supports retry", async ({
  page,
}) => {
  await loadPreview(page);
  let attempts = 0;
  await page.route("**/test-delete-post", (route) =>
    route.fulfill({
      json:
        ++attempts === 1
          ? {
              ok: false,
              error:
                "The post changed. Reload its deletion details before trying again.",
            }
          : { ok: true, removedMediaCount: 1 },
    }),
  );
  const dialog = await open(page);
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Delete post", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("The post changed");
  await expect(dialog.getByRole("checkbox")).toBeChecked();
  await dialog
    .getByRole("button", { name: "Delete post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(attempts).toBe(2);
});
test("failed detail loading blocks deletion and reloads the current version", async ({
  page,
}) => {
  let loads = 0,
    payload: unknown;
  await page.route("**/test-post-deletion-preview?*", (route) =>
    route.fulfill({
      json:
        ++loads === 1
          ? { ok: false, error: "Could not load deletion details." }
          : { ok: true, preview: { ...preview, version: 5 } },
    }),
  );
  await page.route("**/test-delete-post", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { ok: true, removedMediaCount: 0 } });
  });
  await page.goto("/post-composer.html");
  await page
    .getByRole("button", {
      name: "Delete post Saved destination test",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Delete post", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Reload deletion details" }).click();
  await expect(
    dialog.getByRole("button", { name: "Delete post", exact: true }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Delete post", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(payload).toMatchObject({ expectedVersion: "5" });
});
test("active publishing blocks deletion with actionable feedback", async ({
  page,
}) => {
  await loadPreview(page, {
    ...preview,
    canDelete: false,
    status: "publishing",
  });
  await page.goto("/post-composer.html");
  await page
    .getByRole("button", {
      name: "Delete post Saved destination test",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(/Publishing work is in progress/),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Delete post", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Reload deletion details" }),
  ).toBeVisible();
});
for (const theme of ["light", "dark"]) {
  test(`scheduled-post confirmation is responsive in ${theme} and protects shared media`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loadPreview(page, {
      ...preview,
      status: "scheduled",
      mediaCount: 2,
      removableMediaCount: 0,
    });
    const dialog = await open(page, `/post-composer.html?theme=${theme}`);
    await expect(dialog.getByRole("checkbox")).toBeDisabled();
    await expect(dialog).toContainText(
      "Shared media and project-owned renders are kept",
    );
    await expect(dialog).toContainText("also cancels its schedule");
    await expect(
      dialog.getByRole("button", { name: "Delete post", exact: true }),
    ).toBeInViewport({ ratio: 1 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `.vercel/post-deletion-${theme}-phone.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({
      path: `.vercel/post-deletion-${theme}-desktop.png`,
    });
  });
}
