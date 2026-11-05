import { z } from "zod";
import type { SocialPostComposerView } from "@/lib/social/social-post-view";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { socialPostConnectionIdsSchema } from "@studio/contracts";
export const draftKey = "vcstudio-social-draft-fixture";
export const personalId = "44444444-4444-4444-8444-444444444444";
export const businessId = "55555555-5555-4555-8555-555555555555";
export const libraryImage: MediaAssetView = {
  id: "77777777-7777-4777-8777-777777777777",
  kind: "image",
  title: "Library image one",
  altText: "Library image one",
  tags: [],
  contentType: "image/png",
  sizeBytes: 100,
  width: 800,
  height: 600,
  durationMilliseconds: null,
  originalFileName: "library.png",
  createdAt: "2026-11-05T00:00:00Z",
  previewUrl: "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=",
};
export const uploadedImage: MediaAssetView = {
  ...libraryImage,
  id: "88888888-8888-4888-8888-888888888888",
  title: "Uploaded image",
  altText: "Uploaded image",
  originalFileName: "uploaded.png",
};
export const uploadedVideo: MediaAssetView = {
  ...libraryImage,
  id: "99999999-9999-4999-8999-999999999999",
  kind: "video",
  contentType: "video/mp4",
  title: "Uploaded video",
  altText: "Uploaded video",
  originalFileName: "uploaded.mp4",
  durationMilliseconds: 5000,
  previewUrl: "",
  inspectionPending: true,
};
export function fixtureAssets(): MediaAssetView[] {
  const videoStatus = localStorage.getItem("fixture-video-status");
  const video =
    videoStatus === "ready"
      ? { ...uploadedVideo, inspectionPending: false }
      : videoStatus === "failed"
        ? { ...uploadedVideo, inspectionPending: false, inspectionFailed: true }
        : uploadedVideo;
  return [libraryImage, uploadedImage, video];
}
export const draftStateSchema = z.object({
  version: z.number(),
  name: z.string(),
  connectionIds: socialPostConnectionIdsSchema,
  attachmentIds: z.array(z.string()).default([]),
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
        attachmentIds: [],
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
    attachments: state.attachmentIds.flatMap((id) => {
      const asset = fixtureAssets().find((item) => item.id === id);
      return asset
        ? [
            {
              source: "library" as const,
              asset,
              unavailable: Boolean(
                asset.inspectionPending || asset.inspectionFailed,
              ),
            },
          ]
        : [];
    }),
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
