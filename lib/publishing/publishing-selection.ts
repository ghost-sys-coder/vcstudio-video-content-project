import type { VideoPublication } from "@/db/schema";

type PublishingConnectionTarget = {
  id: string;
  status: "active" | "expired" | "revoked";
};

type PublishingRenderTarget = {
  id: string;
};

type PublishingPublicationTarget = {
  connectionId: string;
  renderId: string;
  status: VideoPublication["status"];
};

export function isActivePublicationStatus(
  status: VideoPublication["status"],
): boolean {
  return (
    status === "pending" ||
    status === "queued" ||
    status === "uploading" ||
    status === "processing"
  );
}

/**
 * Chooses which account and render the publish panel opens on.
 *
 * The order is deliberate. An in-flight publication wins, so the panel resumes
 * what is already running. Otherwise the project's assigned production channel
 * decides, because that is the creator's stated intent for this project.
 *
 * Only when there is no channel and exactly one active account does it fall
 * back to that account — with several connected and no channel assigned there
 * is no honest default, so it selects nothing and makes the user choose. The
 * previous behaviour picked the most recently updated active connection, which
 * is how a video gets uploaded to an unrelated channel.
 */
export function selectInitialPublishingTarget(input: {
  connections: PublishingConnectionTarget[];
  renders: PublishingRenderTarget[];
  publications: PublishingPublicationTarget[];
  /** Connection implied by the project's assigned channel, when it has one. */
  channelConnectionId?: string | null;
}): { connectionId: string; renderId: string } {
  const activeConnectionIds = new Set(
    input.connections
      .filter((connection) => connection.status === "active")
      .map((connection) => connection.id),
  );
  const availableRenderIds = new Set(input.renders.map((render) => render.id));
  const activePublication = input.publications.find(
    (publication) =>
      isActivePublicationStatus(publication.status) &&
      activeConnectionIds.has(publication.connectionId),
  );

  const channelIsActive =
    input.channelConnectionId !== null &&
    input.channelConnectionId !== undefined &&
    activeConnectionIds.has(input.channelConnectionId);
  const activeConnections = input.connections.filter(
    (connection) => connection.status === "active",
  );
  const soleActiveConnectionId =
    activeConnections.length === 1 ? activeConnections[0]?.id : undefined;

  return {
    connectionId:
      activePublication?.connectionId ??
      (channelIsActive ? input.channelConnectionId : undefined) ??
      soleActiveConnectionId ??
      "",
    renderId:
      activePublication && availableRenderIds.has(activePublication.renderId)
        ? activePublication.renderId
        : (input.renders[0]?.id ?? ""),
  };
}

export function findActivePublicationForTarget(
  publications: PublishingPublicationTarget[],
  target: { connectionId: string; renderId: string },
): PublishingPublicationTarget | null {
  return (
    publications.find(
      (publication) =>
        publication.connectionId === target.connectionId &&
        publication.renderId === target.renderId &&
        isActivePublicationStatus(publication.status),
    ) ?? null
  );
}
