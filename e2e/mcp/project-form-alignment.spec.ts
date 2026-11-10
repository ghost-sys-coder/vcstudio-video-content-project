import { expect, test, type Locator } from "@playwright/test";

async function expectAlignedControls(select: Locator, action: Locator) {
  const [field, button] = await Promise.all([
    select.boundingBox(),
    action.boundingBox(),
  ]);
  if (!field || !button) throw new Error("Expected visible form controls.");
  expect(field.height).toBe(40);
  expect(button.height).toBe(40);
  expect(Math.abs(field.y - button.y)).toBeLessThanOrEqual(1);
}

for (const theme of ["light", "dark"]) {
  for (const width of [390, 768, 1440]) {
    test(`project form controls align in ${theme} at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1100 });
      await page.goto(`/project-form-alignment.html?theme=${theme}`);
      const voice = page.getByRole("combobox", { name: "Voice preset" });
      const createVoice = page.getByRole("button", {
        name: "New voice preset",
      });
      const visual = page.getByRole("combobox", { name: "Use by default" });
      const saveVisual = page.getByRole("button", {
        name: "Save visual default",
      });
      const channel = page.getByRole("combobox", {
        name: "Channel",
        exact: true,
      });
      const saveChannel = page.getByRole("button", { name: "Save channel" });

      await expectAlignedControls(voice, createVoice);
      if (width >= 640) {
        await expectAlignedControls(visual, saveVisual);
        await expectAlignedControls(channel, saveChannel);
      } else {
        for (const [select, action] of [
          [visual, saveVisual],
          [channel, saveChannel],
        ]) {
          const field = await select!.boundingBox();
          const button = await action!.boundingBox();
          if (!field || !button) throw new Error("Expected visible controls.");
          expect(button.height).toBe(40);
          expect(button.y).toBeGreaterThanOrEqual(field.y + field.height);
          expect(Math.abs(button.x - field.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(button.width - field.width)).toBeLessThanOrEqual(1);
        }
      }

      await voice.click();
      await page.getByRole("option", { name: /deliberately long/ }).click();
      await expect(voice).toContainText("deliberately long");
      await page.mouse.move(0, 0);
      await expectAlignedControls(voice, createVoice);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);

      await expect(saveChannel).toBeDisabled();
      await channel.click();
      await expect(
        page.getByRole("option", { name: /Clear Work Channel/ }),
      ).toBeVisible();
      await page
        .getByRole("option", { name: /independent production channel/ })
        .click();
      await expect(
        page.getByText(/account is not currently connected/),
      ).toBeVisible();
      await saveChannel.click();
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              JSON.parse(
                sessionStorage.getItem("saved-project-channel") ?? "{}",
              ).channelProfileId,
          ),
        )
        .toBe("disconnected-channel");

      await createVoice.click();
      await expect(
        page.getByRole("dialog", { name: "New voice preset" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: testInfo.outputPath("project-form-alignment.png"),
        fullPage: true,
      });
    });
  }
}

test("project controls preserve read-only access", async ({ page }) => {
  await page.goto("/project-form-alignment.html?readOnly=1");
  await expect(
    page.getByRole("button", { name: "New voice preset" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save channel" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Save visual default" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Channel", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("combobox", { name: "Use by default" }),
  ).toBeDisabled();
});
