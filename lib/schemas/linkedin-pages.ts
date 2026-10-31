import { z } from "zod";
import { linkedInOrganizationUrnSchema } from "@/lib/publishing/linkedin-account";

import { LINKEDIN_PAGES_PAGE_SIZE } from "@/lib/publishing/linkedin-pages-navigation";
export const linkedInPagesCursorSchema = z
  .union([z.string().regex(/^\d+$/), z.number()])
  .pipe(
    z.coerce
      .number<string | number>()
      .int()
      .min(0)
      .max(10_000)
      .multipleOf(LINKEDIN_PAGES_PAGE_SIZE),
  );
export const linkedInPageSelectionSchema = z.object({
  pageId: linkedInOrganizationUrnSchema,
  start: linkedInPagesCursorSchema,
});
