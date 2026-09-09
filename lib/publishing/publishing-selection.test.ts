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

  it("selects no connection when two are active and no channel is assigned", () => {
    // Changed deliberately in V2-04. This previously asserted "falls back to
    // the first active connection", which is how a finished video reaches an
    // unrelated channel. With more than one account connected and no channel
    // assigned there is no honest default, so the user must choose. The render
    // default is unaffected.
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [],
      }),
    ).toEqual({ connectionId: "", renderId: "new-render" });
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

describe("selectInitialPublishingTarget — channel-derived target", () => {
  const renders = [{ id: "render-1" }];
  const connections = [
    { id: "connection-other", status: "active" as const },
    { id: "connection-channel", status: "active" as const },
  ];

  it("opens on the project's channel rather than an unrelated active account", () => {
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [],
        channelConnectionId: "connection-channel",
      }).connectionId,
    ).toBe("connection-channel");
  });

  it("selects nothing when several accounts are active and no channel is assigned", () => {
    // The defect this guards: silently defaulting to whichever active account
    // sorted first, which is how a video reaches an unrelated channel.
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [],
      }).connectionId,
    ).toBe("");
  });

  it("still defaults when exactly one account is active", () => {
    expect(
      selectInitialPublishingTarget({
        connections: [{ id: "connection-only", status: "active" }],
        renders,
        publications: [],
      }).connectionId,
    ).toBe("connection-only");
  });

  it("ignores a channel whose account is not active", () => {
    expect(
      selectInitialPublishingTarget({
        connections: [
          { id: "connection-channel", status: "revoked" },
          { id: "connection-other", status: "active" },
        ],
        renders,
        publications: [],
        channelConnectionId: "connection-channel",
      }).connectionId,
    ).toBe("connection-other");
  });

  it("ignores a channel connection that is not in the list at all", () => {
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [],
        channelConnectionId: "connection-from-another-workspace",
      }).connectionId,
    ).toBe("");
  });

  it("lets an in-flight publication win over the channel", () => {
    expect(
      selectInitialPublishingTarget({
        connections,
        renders,
        publications: [
          {
            connectionId: "connection-other",
            renderId: "render-1",
            status: "uploading",
          },
        ],
        channelConnectionId: "connection-channel",
      }).connectionId,
    ).toBe("connection-other");
  });
});
