import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import { task } from "@trigger.dev/sdk";
import { generateObject } from "ai";
import { z } from "zod";
import {
  MARKETING_CAMPAIGN_AUTOMATION_PROMPT_VERSION,
  renderCampaignAutomationPrompt,
} from "@studio/prompts";
import { updateCampaignAutomationState } from "@/db/commands/marketing-campaign-commands";
import {
  attachMediaToMarketingContent,
  createMarketingContentItem,
  failMarketingContentItem,
  updateMarketingContentStructuredPayload,
} from "@/db/commands/marketing-content-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import { findMarketingCampaign } from "@/db/repositories/marketing-campaigns.repository";
import { listActiveMarketingCompetitors } from "@/db/repositories/marketing-research.repository";
import { listMediaAssets } from "@/db/repositories/media-assets.repository";
import { estimateMarketingTextCost } from "@/lib/costs/marketing-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { compileBrandContext } from "@/lib/marketing/brand/compile-brand-context";
import { generateCampaignGraphic } from "@/lib/marketing/campaigns/generate-campaign-graphic";
import { createVideoDraftProject } from "@/lib/marketing/campaigns/create-video-draft-project";
import { runMarketingResearch } from "@/lib/marketing/research/run-marketing-research";
import { selectCampaignPlanItems } from "@/lib/marketing/campaigns/select-campaign-plan-items";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { campaignContentPlanSchema } from "@/lib/schemas/marketing-campaign-automation";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

const payloadSchema = z.object({
  workspaceId: z.uuid(),
  campaignId: z.uuid(),
  requestedByUserId: z.string().min(1),
  attempt: z.number().int().nonnegative().default(0),
});

function durationDays(start: string, end: string | null) {
  if (!end) return 30;
  return Math.max(
    1,
    Math.floor(
      (new Date(`${end}T00:00:00Z`).getTime() -
        new Date(`${start}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1,
  );
}

export const marketingCampaignAutomationTask = task({
  id: "marketing-campaign-automation",
  queue: { name: "ai-text", concurrencyLimit: 1 },
  retry: { maxAttempts: 1 },
  maxDuration: 900,
  run: async (payload: z.infer<typeof payloadSchema>) => {
    const input = payloadSchema.parse(payload);
    const campaign = await findMarketingCampaign(input);
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.automationStatus === "completed")
      return { campaignId: campaign.id, status: "completed" as const };
    let contentReservation: {
      runId: string;
      reservationId: string;
      estimatedCostCents: number;
    } | null = null;
    let contentProviderStarted = false;
    let contentReconciled = false;
    try {
      await updateCampaignAutomationState({
        ...input,
        status: "researching",
      });
      const competitors = await listActiveMarketingCompetitors({
        workspaceId: input.workspaceId,
      });
      if (competitors.length === 0)
        throw new Error(
          "Add at least one competitor before campaign content is generated.",
        );
      const campaignContext = `${campaign.name}\n${campaign.briefPlainText}\nKey message: ${campaign.keyMessage}`;
      const research = [];
      research.push(
        await runMarketingResearch({
          workspaceId: input.workspaceId,
          requestedByUserId: input.requestedByUserId,
          kind: "trend",
          topic: `${campaign.name} ${campaign.keyMessage}`,
          campaignContext,
          idempotencySubject: `${campaign.id}:${input.attempt}:trend`,
        }),
      );
      for (const competitor of competitors.slice(0, 3))
        research.push(
          await runMarketingResearch({
            workspaceId: input.workspaceId,
            requestedByUserId: input.requestedByUserId,
            kind: "competitor",
            topic: campaign.name,
            competitor,
            campaignContext,
            idempotencySubject: `${campaign.id}:${input.attempt}:${competitor.id}`,
          }),
        );
      await updateCampaignAutomationState({
        ...input,
        status: "generating",
      });
      const [brand, media] = await Promise.all([
        compileBrandContext({ workspaceId: input.workspaceId }),
        listMediaAssets({ workspaceId: input.workspaceId, limit: 60 }),
      ]);
      const days = durationDays(campaign.startDate, campaign.endDate);
      const maxItems = Math.min(
        30,
        Math.max(
          campaign.platforms.length,
          Math.ceil(days / 7) * campaign.platforms.length,
        ),
      );
      const prompt = renderCampaignAutomationPrompt({
        campaign: `${campaignContext}\nObjective: ${campaign.objective}\nTraffic: ${campaign.trafficType}`,
        durationDays: days,
        platforms: campaign.platforms,
        maxItems,
        brandContext: brand.text,
        researchContext: research
          .map((snapshot) =>
            JSON.stringify({
              snapshotId: snapshot.snapshotId,
              summary: snapshot.document.summary,
              findings: snapshot.document.findings,
              opportunities: snapshot.document.opportunities,
              risks: snapshot.document.risks,
              contentAngles: snapshot.document.contentAngles,
            }),
          )
          .join("\n"),
        mediaContext: media
          .map((asset) =>
            JSON.stringify({
              id: asset.id,
              kind: asset.kind,
              title: asset.title || asset.originalFileName,
              altText: asset.altText,
              tags: asset.tags,
              width: asset.width,
              height: asset.height,
              durationMilliseconds: asset.durationMilliseconds,
            }),
          )
          .join("\n"),
      });
      const environment = getMarketingEnvironment();
      const hashes = getSceneAnalysisEnvironment();
      const estimatedCostCents = estimateMarketingTextCost({
        prompt,
        expectedOutputTokens: 6_000,
        rates: {
          inputCostPerMillionCents:
            environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS,
          outputCostPerMillionCents:
            environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS,
        },
      });
      const reservation = await reserveMarketingUsage({
        workspaceId: input.workspaceId,
        operation: "content_draft",
        estimatedCostCents,
        idempotencyKey: createMarketingOperationIdempotencyKey({
          secret: hashes.IDEMPOTENCY_HASH_SECRET,
          workspaceId: input.workspaceId,
          operation: "content_draft",
          subjectId: `${campaign.id}:${input.attempt}`,
          subjectFingerprint: createHash("sha256").update(prompt).digest("hex"),
          model: environment.MARKETING_CHAT_MODEL,
          promptVersion: MARKETING_CAMPAIGN_AUTOMATION_PROMPT_VERSION,
        }),
        requestedByUserId: input.requestedByUserId,
        model: environment.MARKETING_CHAT_MODEL,
        promptVersion: MARKETING_CAMPAIGN_AUTOMATION_PROMPT_VERSION,
        finalPrompt: prompt,
        requestFingerprint: createRequestFingerprint(
          hashes.REQUEST_FINGERPRINT_SECRET,
          prompt,
        ),
        subjectKind: "campaign",
        subjectId: campaign.id,
      });
      contentReservation = { ...reservation, estimatedCostCents };
      await markMarketingRunRunning({
        workspaceId: input.workspaceId,
        runId: reservation.runId,
        attemptCount: 1,
      });
      const visualAssets = media
        .filter((asset) => asset.kind === "image")
        .slice(0, 8);
      const visualInputs = await Promise.all(
        visualAssets.map(async (asset) => ({
          asset,
          url: await createMediaAssetDownloadUrl(asset.objectKey, 900),
        })),
      );
      contentProviderStarted = true;
      const generated = await generateObject({
        model: openai(environment.MARKETING_CHAT_MODEL),
        schema: campaignContentPlanSchema,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...visualInputs.flatMap(({ asset, url }) => [
                {
                  type: "text" as const,
                  text: `Visually inspect uploaded media asset ${asset.id}. Decide whether its actual subject, composition, branding, and format make it relevant to this campaign.`,
                },
                { type: "image" as const, image: url },
              ]),
            ],
          },
        ],
      });
      const researchIds = new Set(research.map((item) => item.snapshotId));
      const mediaIds = new Set(media.map((asset) => asset.id));
      const plan = campaignContentPlanSchema.parse(generated.object);
      const validItems = selectCampaignPlanItems({
        items: plan.items,
        platforms: campaign.platforms,
        maximumItems: maxItems,
      });
      if (validItems.length === 0)
        throw new Error("The campaign plan contained no eligible content.");
      for (const planned of validItems) {
        if (
          planned.researchSnapshotIds.some((id) => !researchIds.has(id)) ||
          (planned.mediaAssetId && !mediaIds.has(planned.mediaAssetId))
        )
          throw new Error("The campaign plan referenced unknown context.");
        const item = await createMarketingContentItem({
          workspaceId: input.workspaceId,
          campaignId: campaign.id,
          kind: planned.kind,
          platform: planned.platform,
          title: planned.title,
          bodyDocument: plainTextToPortableDocument(planned.body),
          bodyPlainText: planned.body,
          sourceRunId: reservation.runId,
          createdByUserId: input.requestedByUserId,
          trafficType: planned.trafficType,
          scheduledFor: new Date(
            new Date(`${campaign.startDate}T12:00:00Z`).getTime() +
              Math.min(planned.scheduledDayOffset, days - 1) * 86_400_000,
          ),
          structuredPayload: {
            scheduledDayOffset: planned.scheduledDayOffset,
            visualDirection: planned.visualDirection,
            researchSnapshotIds: planned.researchSnapshotIds,
            researchRationale: planned.researchRationale,
            strategySummary: plan.strategySummary,
            ...(planned.adPayload
              ? {
                  headline: planned.adPayload.headline,
                  primaryText: planned.body,
                  description: planned.adPayload.description,
                  cta: planned.adPayload.cta,
                  platform: planned.platform,
                  placement: planned.adPayload.placement,
                  variantLabel: planned.adPayload.variantLabel,
                }
              : {}),
          },
        });
        try {
          if (planned.mediaAssetId)
            await attachMediaToMarketingContent({
              workspaceId: input.workspaceId,
              contentItemId: item.id,
              mediaAssetId: planned.mediaAssetId,
            });
          else if (planned.kind === "graphic")
            await generateCampaignGraphic({
              workspaceId: input.workspaceId,
              campaignId: campaign.id,
              contentItemId: item.id,
              platform: planned.platform,
              title: planned.title,
              prompt: `${planned.visualDirection}\nCampaign: ${campaign.name}\nKey message: ${campaign.keyMessage}\nCreate a polished social graphic. Do not render logos or text unless explicitly described.`,
              requestedByUserId: input.requestedByUserId,
            });
          else if (planned.kind === "media_story") {
            const project = await createVideoDraftProject({
              workspaceId: input.workspaceId,
              userId: input.requestedByUserId,
              requestNonce: `${campaign.id}:${item.id}`,
              title: planned.title,
              topic: planned.body,
              audience:
                campaign.briefPlainText || "The campaign's target audience",
              tone: "On-brand, current, and platform-native",
              platform: planned.platform,
              aspectRatio: ["tiktok", "instagram"].includes(planned.platform)
                ? "9:16"
                : planned.platform === "youtube"
                  ? "16:9"
                  : "1:1",
              durationSeconds: 60,
              hookAngle: planned.researchRationale,
            });
            await updateMarketingContentStructuredPayload({
              workspaceId: input.workspaceId,
              contentItemId: item.id,
              structuredPayload: {
                ...(item.structuredPayload ?? {}),
                projectId: project.id,
                storyboardPath: `/app/projects/${project.id}/storyboard`,
              },
            });
          }
        } catch {
          await failMarketingContentItem({
            workspaceId: input.workspaceId,
            contentItemId: item.id,
            category: "campaign_media_generation_failed",
            message:
              "This campaign item was planned, but its media could not be prepared.",
          });
        }
      }
      const actualCostCents = Math.max(
        0,
        Math.ceil(
          ((generated.usage.inputTokens ?? 0) *
            environment.MARKETING_CHAT_INPUT_COST_PER_MILLION_CENTS +
            (generated.usage.outputTokens ?? 0) *
              environment.MARKETING_CHAT_OUTPUT_COST_PER_MILLION_CENTS) /
            1_000_000,
        ),
      );
      await reconcileMarketingUsage({
        workspaceId: input.workspaceId,
        runId: reservation.runId,
        reservationId: reservation.reservationId,
        operation: "content_draft",
        actualCostCents,
        inputTokens: generated.usage.inputTokens ?? 0,
        outputTokens: generated.usage.outputTokens ?? 0,
        providerRequestId: generated.response.id,
        safeMetadata: {
          campaignId: campaign.id,
          generatedItems: validItems.length,
          researchSnapshots: research.map((item) => item.snapshotId),
        },
      });
      contentReconciled = true;
      await updateCampaignAutomationState({
        ...input,
        status: "completed",
      });
      return {
        campaignId: campaign.id,
        status: "completed" as const,
        generatedItems: validItems.length,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Campaign content generation failed.";
      if (contentReservation && !contentReconciled)
        await failMarketingRun({
          workspaceId: input.workspaceId,
          runId: contentReservation.runId,
          reservationId: contentReservation.reservationId,
          operation: "content_draft",
          category: "campaign_generation_failed",
          message: "Campaign content generation failed.",
          chargedCostCents: contentProviderStarted
            ? contentReservation.estimatedCostCents
            : 0,
        });
      await updateCampaignAutomationState({
        ...input,
        status: "failed",
        error: message,
      });
      return { campaignId: campaign.id, status: "failed" as const, message };
    }
  },
});
