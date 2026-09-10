import "server-only";
import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  channelProfiles,
  projectOutputVariants,
  type Project,
  type PublicationVisibility,
} from "@/db/schema";
import {
  listLatestSucceededRendersForProject,
  listReleasePackagesForProject,
} from "@/db/repositories/release-packages.repository";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";
import {
  VIDEO_CONTENT_PLATFORMS,
  type VideoContentPlatform,
} from "@/lib/platforms/video-content-platforms";
import {
  describeReleaseDestination,
  releasePackageKey,
  resolveReleasePackageState,
  type ReleasePackageState,
} from "@/lib/releases/release-package";

export interface ReleasePackageView {
  /** Null until the package has been saved for the first time. */
  id: string | null;
  key: string;
  outputVariantId: string;
  outputLabel: string;
  platform: VideoContentPlatform;
  platformLabel: string;
  channelProfileId: string | null;
  channelName: string | null;
  destinationLabel: string;
  /** Null for a package that does not exist yet; the optimistic lock otherwise. */
  revision: number | null;
  title: string;
  titleSuggestionId: string | null;
  description: string;
  tags: string[];
  visibility: PublicationVisibility;
  thumbnailGenerationId: string | null;
  thumbnailAvailable: boolean;
  caption: string | null;
  shareToFeed: boolean | null;
  plannedReleaseAtIso: string | null;
  madeForKids: boolean | null;
  containsSyntheticMedia: boolean | null;
  youtubePlaylistId: string | null;
  latestRenderId: string | null;
  reviewedRenderId: string | null;
  state: ReleasePackageState;
}

export interface ReleasePackagesView {
  packages: ReleasePackageView[];
}

export type ReleasePackageActionResult = {
  success: boolean;
  error: string | null;
  /** The revision to build the next save on, when the save succeeded. */
  revision: number | null;
};

/**
 * Every destination this project could release to, with its saved package.
 *
 * A destination is offered whether or not a package has been saved for it yet,
 * so a creator can start packaging before anything is rendered. That is what
 * "allow title and thumbnail planning before rendering" requires; the state
 * resolver is what stops an unrendered package from being dispatched.
 *
 * Shorts are deliberately absent. The schema carries them, but a Short's own
 * title, thumbnail and channel are V2-15's scope, and offering half of that
 * here would imply a Short can be packaged when nothing yet renders one.
 */
export async function loadReleasePackagesView(input: {
  workspaceId: string;
  project: Project;
}): Promise<ReleasePackagesView> {
  const database = getDatabase();
  const [outputs, packageRows, latestRenders, assignedChannel] =
    await Promise.all([
      database
        .select({
          id: projectOutputVariants.id,
          name: projectOutputVariants.name,
          aspectRatio: projectOutputVariants.aspectRatio,
        })
        .from(projectOutputVariants)
        .where(
          and(
            eq(projectOutputVariants.workspaceId, input.workspaceId),
            eq(projectOutputVariants.projectId, input.project.id),
          ),
        ),
      listReleasePackagesForProject({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      }),
      listLatestSucceededRendersForProject({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      }),
      input.project.channelProfileId
        ? database
            .select({
              id: channelProfiles.id,
              name: channelProfiles.name,
              platform: channelProfiles.platform,
            })
            .from(channelProfiles)
            .where(
              and(
                eq(channelProfiles.id, input.project.channelProfileId),
                eq(channelProfiles.workspaceId, input.workspaceId),
              ),
            )
            .limit(1)
        : Promise.resolve([]),
    ]);

  const channel = assignedChannel[0] ?? null;
  const savedByKey = new Map(
    packageRows
      .filter((row) => row.package.shortCompositionId === null)
      .map((row) => [
        releasePackageKey({
          target: {
            outputVariantId: row.package.outputVariantId,
            shortCompositionId: null,
          },
          destination: {
            platform: row.package.platform as VideoContentPlatform,
            channelProfileId: row.package.channelProfileId,
          },
        }),
        row,
      ]),
  );
  const latestByOutput = new Map(
    latestRenders
      .filter((render) => render.shortCompositionId === null)
      .map((render) => [render.outputVariantId, render.renderId]),
  );

  const packages: ReleasePackageView[] = [];
  for (const output of outputs)
    for (const platform of VIDEO_CONTENT_PLATFORMS) {
      // The project's assigned channel is the destination only for its own
      // platform. Pointing a TikTok release at a YouTube channel profile would
      // be a cross-destination leak of exactly the kind this slice removes.
      const channelProfileId =
        channel && channel.platform === platform ? channel.id : null;
      const key = releasePackageKey({
        target: { outputVariantId: output.id, shortCompositionId: null },
        destination: { platform, channelProfileId },
      });
      const saved = savedByKey.get(key) ?? null;
      const latestRenderId = latestByOutput.get(output.id) ?? null;
      const platformLabel = CONTENT_PLATFORM_LABELS[platform];
      const channelName = saved?.channelName ?? channel?.name ?? null;

      packages.push({
        id: saved?.package.id ?? null,
        key,
        outputVariantId: output.id,
        outputLabel: `${output.name} · ${output.aspectRatio}`,
        platform,
        platformLabel,
        channelProfileId,
        channelName: channelProfileId ? channelName : null,
        destinationLabel: describeReleaseDestination({
          platformLabel,
          channelName: channelProfileId ? channelName : null,
        }),
        revision: saved?.package.revision ?? null,
        title: saved?.package.title ?? "",
        titleSuggestionId: saved?.package.titleSuggestionId ?? null,
        description: saved?.package.description ?? "",
        tags: saved?.package.tags ?? [],
        visibility: saved?.package.visibility ?? "private",
        thumbnailGenerationId: saved?.package.thumbnailGenerationId ?? null,
        thumbnailAvailable: saved?.thumbnailAvailable ?? false,
        caption: saved?.package.caption ?? null,
        shareToFeed: saved?.package.shareToFeed ?? null,
        plannedReleaseAtIso:
          saved?.package.plannedReleaseAt?.toISOString() ?? null,
        madeForKids: saved?.package.madeForKids ?? null,
        containsSyntheticMedia: saved?.package.containsSyntheticMedia ?? null,
        youtubePlaylistId: saved?.package.youtubePlaylistId ?? null,
        latestRenderId,
        reviewedRenderId: saved?.package.reviewedRenderId ?? null,
        state: resolveReleasePackageState({
          platform,
          title: saved?.package.title ?? "",
          caption: saved?.package.caption ?? null,
          thumbnailChosen: saved?.package.thumbnailGenerationId !== null,
          thumbnailAvailable: saved?.thumbnailAvailable ?? false,
          latestRenderId,
          reviewedRenderId: saved?.package.reviewedRenderId ?? null,
        }),
      });
    }

  return { packages };
}
