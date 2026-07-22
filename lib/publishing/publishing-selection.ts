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

export function selectInitialPublishingTarget(input: {
  connections: PublishingConnectionTarget[];
  renders: PublishingRenderTarget[];
  publications: PublishingPublicationTarget[];
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

  return {
    connectionId:
      activePublication?.connectionId ??
      input.connections.find((connection) => connection.status === "active")
        ?.id ??
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
