import { z } from "zod";
import type { SocialPostComposerView } from "@/lib/social/social-post-view";
import { socialPostConnectionIdsSchema } from "@studio/contracts";
export const draftKey = "vcstudio-social-draft-fixture";
export const personalId = "44444444-4444-4444-8444-444444444444";
export const businessId = "55555555-5555-4555-8555-555555555555";
export const draftStateSchema = z.object({
  version: z.number(),
  name: z.string(),
  connectionIds: socialPostConnectionIdsSchema,
});
export function composerFixture(): SocialPostComposerView {
  const raw = localStorage.getItem(draftKey);
  const state = raw
    ? draftStateSchema.parse(JSON.parse(raw))
    : {
        version: 2,
        name: "Saved destination test",
        connectionIds: new URLSearchParams(location.search).has("mcp")
          ? [personalId]
          : [],
      };
  return {
    id: "33333333-3333-4333-8333-333333333333",
    ...state,
    status: "draft",
    bodyDocument: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "A relevant saved post." }],
        },
      ],
    },
    bodyPlainText: "A relevant saved post.",
    scheduledAt: null,
    scheduledTimezone: "UTC",
    editable: true,
    attachments: [],
    targets: [],
    availableConnections: [
      {
        id: personalId,
        platform: "linkedin",
        platformLabel: "LinkedIn",
        accountName: "Tamale Frank",
        status: "active",
      },
      {
        id: businessId,
        platform: "facebook",
        platformLabel: "Facebook",
        accountName: "Business page",
        status: "active",
      },
    ],
  };
}
