import { describe, expect, it } from "vitest";
import {
  findActivePublicationForTarget,
  selectInitialPublishingTarget,
} from "@/lib/publishing/publishing-selection";

const connections = [
  { id: "tiktok-connection", status: "active" as const },
  { id: "youtube-connection", status: "active" as const },
];
const renders = [{ id: "new-render" }, { id: "publishing-render" }];

describe("publishing target selection", () => {
  it("restores the connection and render from an active publication", () => {
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [
          {
            connectionId: "youtube-connection",
            renderId: "publishing-render",
            status: "uploading",
          },
        ],
      }),
    ).toEqual({
      connectionId: "youtube-connection",
      renderId: "publishing-render",
    });
  });

  it("falls back to the first active connection and newest render", () => {
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [],
      }),
    ).toEqual({ connectionId: "tiktok-connection", renderId: "new-render" });
  });

  it("matches loading state only to the selected connection and render", () => {
    const publications = [
      {
        connectionId: "youtube-connection",
        renderId: "publishing-render",
        status: "processing" as const,
      },
    ];

    expect(
      findActivePublicationForTarget(publications, {
        connectionId: "youtube-connection",
        renderId: "publishing-render",
      }),
    ).toEqual(publications[0]);
    expect(
      findActivePublicationForTarget(publications, {
        connectionId: "tiktok-connection",
        renderId: "publishing-render",
      }),
    ).toBeNull();
  });
});
