import type { ContentPlatform } from "@/db/schema";
import { linkedInOrganizationUrnSchema } from "@/lib/publishing/linkedin-account";
import { CONTENT_PLATFORM_LABELS } from "@/lib/titles/title-view";

export function platformConnectionLabel(connection: {
  platform: ContentPlatform;
  externalAccountId: string;
}): string {
  return connection.platform === "linkedin"
    ? linkedInOrganizationUrnSchema.safeParse(connection.externalAccountId)
        .success
      ? "LinkedIn Page"
      : "LinkedIn profile"
    : CONTENT_PLATFORM_LABELS[connection.platform];
}
