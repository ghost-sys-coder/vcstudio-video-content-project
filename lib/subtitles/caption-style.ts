import { z } from "zod";
import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a #rrggbb hex value")
  .transform((value) => value.toLowerCase());

/**
 * Canonical caption style validation. Every persisted or exported caption style
 * passes through this schema, so the renderer and export formats always receive
 * bounded, well-formed values (satisfying the "caption style validation" test).
 */
export const captionStyleSchema: z.ZodType<CaptionStyleData> = z.object({
  fontFamily: z.string().trim().min(1).max(64),
  fontSizePercent: z.coerce.number().min(1).max(20),
  primaryColor: hexColorSchema,
  outlineColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  backgroundOpacityPercent: z.coerce.number().int().min(0).max(100),
  position: z.enum(["bottom", "middle", "top"]),
  bold: z.boolean(),
  uppercase: z.boolean(),
  maxLineCharacters: z.coerce.number().int().min(16).max(120),
  safeMarginPercent: z.coerce.number().min(0).max(25),
});

export const DEFAULT_CAPTION_STYLE: CaptionStyleData = {
  fontFamily: "Inter",
  fontSizePercent: 4.5,
  primaryColor: "#ffffff",
  outlineColor: "#000000",
  backgroundColor: "#000000",
  backgroundOpacityPercent: 55,
  position: "bottom",
  bold: true,
  uppercase: false,
  maxLineCharacters: 42,
  safeMarginPercent: 8,
};

/**
 * Validates arbitrary input against the caption style schema, filling any
 * missing fields from {@link DEFAULT_CAPTION_STYLE} first so partial updates
 * (for example a single changed color) remain valid.
 */
export function parseCaptionStyle(input: unknown): CaptionStyleData {
  const merged =
    input && typeof input === "object"
      ? { ...DEFAULT_CAPTION_STYLE, ...(input as Record<string, unknown>) }
      : DEFAULT_CAPTION_STYLE;
  return captionStyleSchema.parse(merged);
}

/**
 * Coerces a stored value into a valid caption style without throwing. Used when
 * reading persisted rows so a legacy or corrupt value degrades to defaults
 * rather than crashing a read.
 */
export function coerceCaptionStyle(input: unknown): CaptionStyleData {
  const result = captionStyleSchema.safeParse({
    ...DEFAULT_CAPTION_STYLE,
    ...(input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {}),
  });
  return result.success ? result.data : DEFAULT_CAPTION_STYLE;
}
