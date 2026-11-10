import { expect, test } from "@playwright/test";
for (const width of [390, 1440])
  for (const theme of ["light", "dark"])
    test(`ElevenLabs account voice preset at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (mode) =>
          document.addEventListener("DOMContentLoaded", () =>
            document.documentElement.classList.toggle("dark", mode === "dark"),
          ),
        theme,
      );
      let requests = 0;
      await page.route("**/api/elevenlabs/voices*", async (route) => {
        requests++;
        await route.fulfill({
          json: {
            voices: [{ id: "ownedVoice1234567890", name: "Frank’s Voice" }],
            model: "eleven_multilingual_v2",
            nextCursor: null,
          },
        });
      });
      await page.goto("/elevenlabs-voice.html");
      expect(requests).toBe(0);
      await page.getByLabel("Provider", { exact: true }).click();
      await page.getByRole("option", { name: "ElevenLabs · in-house" }).click();
      await expect(page.getByLabel("ElevenLabs account voice")).toContainText(
        "Frank’s Voice",
      );
      await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
        "eleven_multilingual_v2",
      );
      await expect(page.getByText(/Private in-house service/)).toBeVisible();
      await page.getByLabel("Name", { exact: true }).fill("Frank narration");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 1440)
        await page.screenshot({
          path: `.vercel/elevenlabs-voice-${theme}.png`,
          fullPage: true,
        });
      await page.getByRole("button", { name: "Save voice preset" }).click();
      await expect(page.getByLabel("Saved preset")).toContainText(
        '"provider":"elevenlabs"',
      );
      await expect(page.getByLabel("Saved preset")).toContainText(
        '"voice":"ownedVoice1234567890"',
      );
      expect(requests).toBe(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
test("ElevenLabs picker shows an actionable disabled/error state and can retry", async ({
  page,
}) => {
  let attempt = 0;
  await page.route("**/api/elevenlabs/voices*", (route) => {
    attempt++;
    return attempt === 1
      ? route.fulfill({
          status: 403,
          json: { error: "ElevenLabs is switched off on this deployment." },
        })
      : route.fulfill({
          json: {
            voices: [{ id: "ownedVoice1234567890", name: "Frank’s Voice" }],
            model: "eleven_multilingual_v2",
            nextCursor: null,
          },
        });
  });
  await page.goto("/elevenlabs-voice.html");
  await page.getByLabel("Provider", { exact: true }).click();
  await page.getByRole("option", { name: "ElevenLabs · in-house" }).click();
  await expect(page.getByRole("alert")).toContainText("switched off");
  await expect(
    page.getByRole("button", { name: "Save voice preset" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByLabel("ElevenLabs account voice")).toContainText(
    "Frank’s Voice",
  );
});
