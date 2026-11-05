import type {
  ProductionQueueItem,
  ProductionQueuePage,
} from "@/db/repositories/production-queue.repository";
import {
  resolveProductionReadiness,
  type ProjectProductionFacts,
} from "@/lib/production/production-readiness";
import { productionQueueQuerySchema } from "@/lib/schemas/production-queue";

export const queueChannels = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Studio explainers" },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Creator notes and practical lessons from the production workspace",
  },
];

function project(
  index: number,
  name: string,
  overrides: Partial<ProjectProductionFacts> = {},
): ProductionQueueItem {
  const projectId = `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
  const facts: ProjectProductionFacts = {
    projectId,
    hasApprovedScript: true,
    hasScriptDraft: true,
    sceneCount: 1,
    scenesAwaitingReview: 0,
    imagesSucceeded: 1,
    imagesAwaitingReview: 0,
    imagesFailed: 0,
    scenesWithoutApprovedImage: 0,
    audioSucceeded: 1,
    audioAwaitingReview: 0,
    audioFailed: 0,
    rendersSucceeded: 0,
    rendersFailed: 0,
    rendersInFlight: 0,
    publicationsSucceeded: 0,
    publicationsFailed: 0,
    plannedReleaseAt: null,
    ...overrides,
  };
  const channel = queueChannels[index % 2 === 1 ? 0 : 1];
  return {
    projectId,
    name,
    editorialStatus: "planning",
    channelProfileId: channel.id,
    channelName: channel.name,
    plannedReleaseAt: facts.plannedReleaseAt,
    updatedAt: new Date("2026-11-05T08:00:00Z"),
    readiness: resolveProductionReadiness(facts),
  };
}

export const queueProjects: ProductionQueueItem[] = [
  project(
    1,
    "Building a repeatable creative process without losing the details that make each story work",
    {
      hasApprovedScript: false,
      hasScriptDraft: false,
      sceneCount: 0,
      imagesSucceeded: 0,
      audioSucceeded: 0,
    },
  ),
  project(2, "The generalist advantage", {
    sceneCount: 2,
    scenesAwaitingReview: 1,
    imagesAwaitingReview: 1,
    imagesFailed: 1,
    scenesWithoutApprovedImage: 1,
  }),
  project(3, "A finished render ready for release", { rendersSucceeded: 1 }),
  project(4, "A published story", {
    rendersSucceeded: 1,
    publicationsSucceeded: 1,
  }),
  project(5, "A planned November release", {
    plannedReleaseAt: new Date("2026-11-11T07:00:00Z"),
  }),
  project(6, "A script waiting for approval", { hasApprovedScript: false }),
  project(7, "Recovering an audio task", { audioFailed: 1 }),
  project(8, "A render currently running", { rendersInFlight: 1 }),
];

/** Models the existing bounded query: channel before paging, readiness after. */
export function queueFixture(search: string) {
  const params = new URLSearchParams(search);
  const query = productionQueueQuerySchema.parse({
    ...Object.fromEntries(params),
    pageSize: "4",
  });
  const rows =
    params.get("state") === "empty"
      ? []
      : queueProjects.filter(
          (item) =>
            !query.channelProfileId ||
            item.channelProfileId === query.channelProfileId,
        );
  const items = rows
    .slice((query.page - 1) * query.pageSize, query.page * query.pageSize)
    .filter(
      (item) =>
        (query.release === "all" ||
          item.readiness.releaseState === query.release) &&
        (query.attention === "all" ||
          (query.attention === "blocked"
            ? item.readiness.blockers.some(
                (entry) => entry.severity === "blocking",
              )
            : item.readiness.reviews.length > 0)),
    );
  const queue: ProductionQueuePage = {
    items,
    page: query.page,
    total: rows.length,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(rows.length / query.pageSize)),
  };
  return {
    queue,
    attention: query.attention,
    release: query.release,
    channelProfileId: query.channelProfileId,
    channels: queueChannels,
  };
}
