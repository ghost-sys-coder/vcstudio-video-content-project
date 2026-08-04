import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards the invariants of the three theme blocks in `app/globals.css`.
 *
 * These are asserted against the stylesheet text because nothing else can see
 * them: a missing token or a missing `color-scheme` produces no type error, no
 * runtime error, and no failing component test — it produces a page that looks
 * wrong in one theme only, which is exactly how both bugs this file covers
 * reached the browser.
 */
const CSS = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

const THEME_SELECTORS = [":root", ".dark", ".dim"] as const;

/** The theme blocks contain no nested braces, so this is unambiguous. */
function themeBlock(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Theme block ${selector} not found.`);
  const end = CSS.indexOf("\n}", start);
  return CSS.slice(start, end);
}

/**
 * Tokens that intentionally live only in `:root`.
 *
 * `--radius` is geometry, not colour: corner rounding is an identity of the
 * product, not of the lighting, so a theme redefining it would be a bug rather
 * than the omission this parity check is looking for.
 */
const THEME_INDEPENDENT_TOKENS = new Set(["--radius"]);

function declaredTokens(selector: string): Set<string> {
  return new Set(
    [...themeBlock(selector).matchAll(/^\s*(--[a-z0-9-]+):/gm)]
      .map((match) => match[1]!)
      .filter((token) => !THEME_INDEPENDENT_TOKENS.has(token)),
  );
}

describe("color-scheme", () => {
  it.each(THEME_SELECTORS)("%s declares a color-scheme", (selector) => {
    // Without this the operating system paints native <select> option lists,
    // scrollbars and date pickers with the light palette regardless of the
    // page. On a dark page that is a white popup with unreadable options.
    expect(themeBlock(selector)).toMatch(/color-scheme:\s*(light|dark)/);
  });

  it("uses the light scheme for the default theme", () => {
    expect(themeBlock(":root")).toMatch(/color-scheme:\s*light/);
  });

  it.each([".dark", ".dim"])("%s uses the dark scheme", (selector) => {
    // Dim is a dark-direction theme despite its name; a light scheme here
    // would give it white dropdowns on a navy surface.
    expect(themeBlock(selector)).toMatch(/color-scheme:\s*dark/);
  });
});

describe("theme token parity", () => {
  const base = declaredTokens(":root");

  it("defines a meaningful number of tokens in the default theme", () => {
    expect(base.size).toBeGreaterThan(30);
  });

  it.each([".dark", ".dim"])(
    "%s redefines every token the default theme declares",
    (selector) => {
      // A token missing from one theme silently inherits the light value,
      // which is how a dark surface ends up with a light-mode colour on it.
      const missing = [...base].filter(
        (token) => !declaredTokens(selector).has(token),
      );
      expect(missing).toEqual([]);
    },
  );

  it.each([".dark", ".dim"])(
    "%s introduces no token the default theme lacks",
    (selector) => {
      // The reverse direction: a token defined only in a dark theme is
      // undefined in light, which renders as an invalid value rather than a
      // wrong colour.
      const extra = [...declaredTokens(selector)].filter(
        (token) => !base.has(token),
      );
      expect(extra).toEqual([]);
    },
  );
});

describe("the dim theme", () => {
  const block = themeBlock(".dim");

  it("keeps a dark contrast direction", () => {
    // Dim sits between light and dark in luminance but keeps dark's
    // light-text-on-a-dark-surface direction; averaging the two schemes
    // component-wise would cancel the contrast out entirely.
    const background = block.match(/--background:\s*oklch\(([\d.]+)/)?.[1];
    const foreground = block.match(/--foreground:\s*oklch\(([\d.]+)/)?.[1];
    expect(Number(background)).toBeLessThan(0.5);
    expect(Number(foreground)).toBeGreaterThan(0.8);
  });

  it("softens the foreground off pure white", () => {
    // A large low-luminance surface with moderated-brightness text is what
    // reduces strain; a maximum-contrast pairing is not the same thing.
    const foreground = Number(
      block.match(/--foreground:\s*oklch\(([\d.]+)/)?.[1],
    );
    expect(foreground).toBeLessThan(0.98);
  });

  it("carries the Stripe navy tint on its surfaces", () => {
    // Chroma above zero is what distinguishes this from the neutral-grey
    // version it replaced.
    const chroma = Number(
      block.match(/--background:\s*oklch\([\d.]+\s+([\d.]+)/)?.[1],
    );
    expect(chroma).toBeGreaterThan(0.01);
  });

  it("keeps surface chroma restrained enough to read against", () => {
    // Navy carries the identity, but a saturated background is fatiguing over
    // a long session.
    const chroma = Number(
      block.match(/--background:\s*oklch\([\d.]+\s+([\d.]+)/)?.[1],
    );
    expect(chroma).toBeLessThan(0.08);
  });

  it("reserves its saturated accent for the primary action", () => {
    const primaryChroma = Number(
      block.match(/--primary:\s*oklch\([\d.]+\s+([\d.]+)/)?.[1],
    );
    const mutedChroma = Number(
      block.match(/--muted:\s*oklch\([\d.]+\s+([\d.]+)/)?.[1],
    );
    expect(primaryChroma).toBeGreaterThan(mutedChroma * 3);
  });
});
