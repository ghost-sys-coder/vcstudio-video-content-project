import {
  AppBridge,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import {
  preview,
  workspaceId,
  operationId,
  mediaId,
  mediaOrigin,
} from "./data";
const withMedia = new URLSearchParams(location.search).has("withMedia");
const withYouTube = new URLSearchParams(location.search).has("youtube");
const autonomous = new URLSearchParams(location.search).has("autonomous");
const generation = new URLSearchParams(location.search).has("generation");
const frame = document.createElement("iframe");
frame.title = "VCStudio review";
frame.style.cssText = "width:100%;height:1200px;border:0";
document.body.append(frame);
const theme =
  new URLSearchParams(location.search).get("theme") === "dark"
    ? "dark"
    : "light";
const bridge = new AppBridge(
  null,
  { name: "Test MCP Apps host", version: "1.0.0" },
  { serverTools: {} },
  { hostContext: { theme } },
);
bridge.oninitialized = async () => {
  await bridge.sendToolInput({ arguments: { workspaceId } });
  await bridge.sendToolResult({
    content: [],
    structuredContent: {
      ok: true,
      data: {
        operation: {
          id: operationId,
          workspaceId,
          status: autonomous ? "prepared" : "requires_approval",
        },
        preview: generation
          ? {
              kind: "audio",
              title: "Business narration",
              text: "A useful business update.",
              model: "fixture-tts",
              provider: "openai",
              estimatedCostCents: 2,
              maximumCostCents: 10,
              projectId: null,
              sceneId: null,
              settings: [
                { label: "Voice", value: "alloy" },
                { label: "Format", value: "mp3" },
              ],
            }
          : withYouTube
            ? {
                ...preview,
                destinations: [
                  {
                    id: preview.destinations[0].id,
                    platform: "youtube",
                    name: "Fixture channel",
                    text: "The approved YouTube description.",
                    youtube: {
                      title: "Exact YouTube title",
                      description: "The approved YouTube description.",
                      visibility: "unlisted",
                      tags: ["VCStudio"],
                      madeForKids: false,
                      containsSyntheticMedia: true,
                      thumbnail: {
                        id: mediaId,
                        name: "YouTube cover",
                        contentType: "image/png",
                        sizeBytes: 100,
                        etag: "thumb-etag",
                      },
                    },
                  },
                ],
              }
            : withMedia
              ? {
                  ...preview,
                  media: [
                    {
                      id: mediaId,
                      name: "Imported portrait",
                      kind: "image",
                      contentType: "image/png",
                      sizeBytes: 100,
                      etag: "etag",
                    },
                  ],
                }
              : preview,
        approvalUrl: `https://vcstudio.example/app/mcp/operations/${operationId}`,
      },
    },
    _meta: {
      approvalProof:
        autonomous || new URLSearchParams(location.search).has("noProof")
          ? undefined
          : "private-user-interface-proof-123456789",
      mediaPreviews:
        withMedia || withYouTube
          ? [
              {
                id: mediaId,
                kind: "image",
                url: `${mediaOrigin}/preview.png?X-Amz-Signature=fixture-only`,
              },
            ]
          : [],
    },
  });
};
bridge.oncalltool = async (params) => {
  if (
    params.name !==
      (generation ? "confirm_generation" : "confirm_publication") ||
    params.arguments?.proof !== "private-user-interface-proof-123456789"
  )
    throw new Error("Invalid approval");
  document.body.dataset.approvals = String(
    Number(document.body.dataset.approvals ?? 0) + 1,
  );
  return {
    content: [],
    structuredContent: { ok: true, data: { status: "succeeded", error: null } },
  };
};
await bridge.connect(
  new PostMessageTransport(frame.contentWindow!, frame.contentWindow!),
);
frame.src = generation ? "/generation.html" : "/review.html";
