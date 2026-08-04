import { z } from "zod";

export const MARKETING_BRAND_ASSET_ROLES = [
  "logo_primary",
  "logo_alt",
  "logo_mark",
  "wordmark",
  "product_shot",
  "team_photo",
  "brand_pattern",
  "font_specimen",
  "screenshot",
  "other",
] as const;

export const BRAND_ASSET_ROLE_LABELS = {
  logo_primary: "Primary logo",
  logo_alt: "Alternate logo",
  logo_mark: "Logo mark",
  wordmark: "Wordmark",
  product_shot: "Product shot",
  team_photo: "Team photo",
  brand_pattern: "Pattern or texture",
  font_specimen: "Font specimen",
  screenshot: "Screenshot",
  other: "Other",
} as const satisfies Record<
  (typeof MARKETING_BRAND_ASSET_ROLES)[number],
  string
>;

export const assignBrandAssetSchema = z.object({
  mediaAssetId: z.uuid(),
  role: z.enum(MARKETING_BRAND_ASSET_ROLES),
  notes: z.string().trim().max(300).default(""),
});

export const removeBrandAssetSchema = z.object({ brandAssetId: z.uuid() });

export type BrandAssetRole = (typeof MARKETING_BRAND_ASSET_ROLES)[number];
