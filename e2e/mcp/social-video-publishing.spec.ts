import { test, expect } from "@playwright/test";
import {
  draftKey,
  libraryImage,
  uploadedVideo,
} from "./fixtures/social-draft-data";
import { mediaOrigin } from "./fixtures/data";

for (const theme of ["light", "dark"]) {
  for (const width of [390, 1440]) {
    test(`YouTube metadata and separate thumbnail persist in ${theme} at ${width}px`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(
        ({ key, video, theme }) => {
          document.addEventListener(
            "DOMContentLoaded",
            () =>
              document.documentElement.classList.toggle(
                "dark",
                theme === "dark",
              ),
            { once: true },
          );
          if (!localStorage.getItem(key))
            localStorage.setItem(
              key,
              JSON.stringify({
                version: 2,
                name: "YouTube publishing test",
                connectionIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
                attachmentIds: [video],
                bodyDocument: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "My video description" }],
                    },
                  ],
                },
              }),
            );
          localStorage.setItem("fixture-video-status", "ready");
        },
        { key: draftKey, video: uploadedVideo.id, theme },
      );
      await page.goto("/post-composer.html?youtube=1");
      await expect(
        page.getByRole("button", { name: "Publish now", exact: true }),
      ).toBeDisabled();
      await page
        .getByLabel("Video title", { exact: true })
        .fill("A relevant long-form video or Short");
      await page
        .getByLabel("YouTube description", { exact: true })
        .fill("The exact description for YouTube.");
      await page
        .getByLabel("Tags", { exact: true })
        .fill("VCStudio, building in public");
      await page
        .getByRole("combobox", { name: "Visibility", exact: true })
        .click();
      await page.getByRole("option", { name: "Unlisted", exact: true }).click();
      await page
        .getByRole("combobox", {
          name: "Is this video made for kids?",
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: "No, not made for kids", exact: true })
        .click();
      await page
        .getByRole("combobox", {
          name: "Realistic altered or synthetic content?",
          exact: true,
        })
        .click();
      await page
        .getByRole("option", { name: "Yes, disclose it", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Choose thumbnail", exact: true })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Choose a YouTube thumbnail",
      });
      await dialog
        .getByRole("button", { name: libraryImage.title, exact: true })
        .click();
      await dialog
        .getByRole("button", { name: "Use thumbnail (1)", exact: true })
        .click();
      await expect(dialog).not.toBeVisible();
      await page
        .getByRole("button", { name: "Save YouTube settings", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Publish now", exact: true }),
      ).toBeEnabled();
      await page.reload();
      await expect(page.getByLabel("Video title", { exact: true })).toHaveValue(
        "A relevant long-form video or Short",
      );
      await expect(
        page.getByLabel("YouTube description", { exact: true }),
      ).toHaveValue("The exact description for YouTube.");
      await expect(
        page.getByRole("combobox", { name: "Visibility", exact: true }),
      ).toContainText("Unlisted");
      await expect(
        page
          .getByRole("heading", { name: "Custom thumbnail", exact: true })
          .locator("..")
          .locator(".."),
      ).toContainText(libraryImage.title);
      const saved = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        draftKey,
      );
      expect(saved.attachmentIds).toEqual([uploadedVideo.id]);
      expect(saved.youtubeThumbnailAssetId).toBe(libraryImage.id);
      expect(saved.youtubeSettings.madeForKids).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(errors).toEqual([]);
      await page
        .getByRole("region", { name: "YouTube upload", exact: true })
        .screenshot({ path: test.info().outputPath("youtube-settings.png") });
      expect(
        await page.evaluate(() => localStorage.getItem("unexpected-dispatch")),
      ).toBeNull();
    });
    test(`MCP YouTube review displays exact metadata and thumbnail before approval in ${theme} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.route(`${mediaOrigin}/**`, (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="5"><rect width="3" height="5" fill="green"/></svg>',
        }),
      );
      await page.goto(`/host.html?youtube=1&theme=${theme}`);
      const review = page.frameLocator("iframe");
      await expect(
        review.getByText("Exact YouTube title", { exact: true }),
      ).toBeVisible();
      await expect(
        review.getByText("The approved YouTube description.", { exact: true }),
      ).toBeVisible();
      const image = review.getByRole("img", {
        name: "YouTube cover",
        exact: true,
      });
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate(
            (el: HTMLImageElement) => el.complete && el.naturalWidth === 3,
          ),
        )
        .toBe(true);
      expect(
        await review
          .locator("html")
          .evaluate((el) => el.scrollWidth <= innerWidth),
      ).toBe(true);
      await expect(page.locator("body")).not.toHaveAttribute("data-approvals");
    });
  }
}
