import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  CaptionStyleData,
  SubtitleSegmentTextOverrides,
} from "@/lib/subtitles/caption-style-data";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";
import type { PortableDocument } from "@/lib/social/portable-document";
import type { MarketingChatMessagePart } from "@/lib/schemas/marketing-chat-message";
import type { MarketingWeeklyDigestSnapshot } from "@/lib/marketing/digests/weekly-digest";
import type { VerifiedMediaMetadata } from "@/lib/media/media-inspection";

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "editor",
  "viewer",
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "processing",
  "completed",
  "failed",
]);

export const storageObjectKindEnum = pgEnum("storage_object_kind", [
  "workspace_logo",
]);

export const mediaAssetKindEnum = pgEnum("media_asset_kind", [
  "image",
  "video",
]);

// Library uploads are two-phase (authorize a signed PUT, then confirm), so a row
// exists before its object does. `pending` is that gap; a row only becomes
// selectable in the composer once the upload was confirmed and inspected.
export const mediaAssetStatusEnum = pgEnum("media_asset_status", [
  "pending",
  "ready",
  "failed",
]);

export const mediaInspectionStatusEnum = pgEnum("media_inspection_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

/**
 * A post's overall state, derived from its per-target states.
 *
 * `partially_failed` is deliberately its own value rather than folded into
 * `failed`: one platform rejecting an aspect ratio while the others published is
 * the normal case, and collapsing that into a single "failed" would hide three
 * successful posts behind one error.
 */
export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "partially_failed",
  "failed",
  "cancelled",
]);

export const socialPostTargetStatusEnum = pgEnum("social_post_target_status", [
  "pending",
  "queued",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);

export const characterStatusEnum = pgEnum("character_status", [
  "draft",
  "active",
  "archived",
]);

export const characterReferenceTypeEnum = pgEnum("character_reference_type", [
  "master",
  "front",
  "threeQuarter",
  "side",
  "fullBody",
  "expression",
  "outfit",
  "pose",
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
]);

export const characterReferenceSourceEnum = pgEnum(
  "character_reference_source",
  ["uploaded", "generated"],
);

export const characterReferenceGenerationStatusEnum = pgEnum(
  "character_reference_generation_status",
  ["queued", "running", "succeeded", "failed"],
);

export const characterAuditActionEnum = pgEnum("character_audit_action", [
  "archived",
  "referenceDeleted",
  "referenceReplaced",
]);

export const projectStatusEnum = pgEnum("project_status", [
  "draft",
  "planning",
  "assetGeneration",
  "review",
  "readyToRender",
  "rendering",
  "completed",
  "failed",
  "archived",
]);

export const projectAspectRatioEnum = pgEnum("project_aspect_ratio", [
  "16:9",
  "9:16",
  "1:1",
]);

/**
 * Whether a project renders AI-generated stills or animated character sprites.
 *
 * This is deliberately a property of the *project*, not the scene: mixing the
 * two within one video produced an unpredictable authoring experience and a
 * visually inconsistent result, so the two modes are structurally exclusive.
 */
export const projectVideoKindEnum = pgEnum("project_video_kind", [
  "staticImages",
  "animatedCharacter",
]);

/** Where a character stands within the frame in an animated scene. */
export const sceneCharacterStageSlotEnum = pgEnum(
  "scene_character_stage_slot",
  ["left", "center", "right"],
);

export const outputVariantStatusEnum = pgEnum("output_variant_status", [
  "draft",
  "ready",
  "archived",
]);

export const sceneFramingModeEnum = pgEnum("scene_framing_mode", [
  "cover",
  "contain",
  "outpaint",
]);

export const shortCompositionStatusEnum = pgEnum("short_composition_status", [
  "draft",
  "ready",
  "archived",
]);

export const scriptVersionStatusEnum = pgEnum("script_version_status", [
  "draft",
  "approved",
  "superseded",
]);

export const sceneStatusEnum = pgEnum("scene_status", [
  "draft",
  "review",
  "approved",
  "generating",
  "generated",
  "revisionRequired",
  "locked",
]);

export const sceneAnalysisStatusEnum = pgEnum("scene_analysis_status", [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
]);

// Distribution platforms for briefs, titles, and thumbnails.
// Every destination the app can address. Which of these a given feature offers
// is decided by that feature's own registry, not by this enum — LinkedIn, for
// example, is a social post destination but never a thumbnail or idea platform.
export const contentPlatformEnum = pgEnum("content_platform", [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
]);

export const performanceMetricKindEnum = pgEnum("performance_metric_kind", [
  "impressions",
  "views",
  "watch_time",
  "retention",
  "engagement",
  "clicks",
  "conversions",
]);

export const performanceMetricUnitEnum = pgEnum("performance_metric_unit", [
  "count",
  "milliseconds",
  "ratio",
]);

export const performanceSyncStatusEnum = pgEnum("performance_sync_status", [
  "pending",
  "ready",
  "unsupported",
  "permission_required",
  "rate_limited",
  "failed",
]);

export const usageReservationStatusEnum = pgEnum("usage_reservation_status", [
  "pending",
  "reconciled",
  "released",
]);

export const imageGenerationStatusEnum = pgEnum("image_generation_status", [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const imageGenerationPurposeEnum = pgEnum("image_generation_purpose", [
  "scene",
  "variant_outpaint",
]);

export const imageGenerationSourceEnum = pgEnum("image_generation_source", [
  "ai_generated",
  "user_uploaded",
]);

export const imageReviewStatusEnum = pgEnum("image_review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const imageQualityEnum = pgEnum("image_quality", [
  "low",
  "medium",
  "high",
]);

export const imageOutputFormatEnum = pgEnum("image_output_format", [
  "webp",
  "png",
  "jpeg",
]);

export const sceneImageBatchStatusEnum = pgEnum("scene_image_batch_status", [
  "pending",
  "processing",
  "cancelled",
]);

export const audioGenerationStatusEnum = pgEnum("audio_generation_status", [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const audioReviewStatusEnum = pgEnum("audio_review_status", [
  "pending",
  "approved",
  "rejected",
]);

export const audioOutputFormatEnum = pgEnum("audio_output_format", [
  "mp3",
  "opus",
  "aac",
  "flac",
  "wav",
  "pcm",
]);

// Superset of audioOutputFormatEnum: also covers the raw browser-recording
// containers (webm/m4a) that a user_recorded generation stores as-is. Kept
// distinct from audioOutputFormatEnum because that enum is also used by
// voicePresets.format and various AI-provider-facing code paths, all of
// which must never see a non-TTS format value.
export const sceneAudioAssetFormatEnum = pgEnum("scene_audio_asset_format", [
  "mp3",
  "opus",
  "aac",
  "flac",
  "wav",
  "pcm",
  "webm",
  "m4a",
]);

export const audioGenerationSourceEnum = pgEnum("audio_generation_source", [
  "ai_generated",
  "user_recorded",
]);

export const customVoiceStatusEnum = pgEnum("custom_voice_status", [
  "active",
  "revoked",
]);

export const subtitleGranularityEnum = pgEnum("subtitle_granularity", [
  "scene",
  "sentence",
]);

export const renderStatusEnum = pgEnum("render_status", [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const providerRequestStatusEnum = pgEnum("provider_request_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const usageOperationTypeEnum = pgEnum("usage_operation_type", [
  "scene_analysis",
  "scene_image_generation",
  "scene_audio_generation",
  "video_render",
  "script_generation",
  "title_generation",
  "thumbnail_generation",
]);

export const platformConnectionStatusEnum = pgEnum(
  "platform_connection_status",
  ["active", "expired", "revoked"],
);

export const videoPublicationStatusEnum = pgEnum("video_publication_status", [
  "pending",
  "queued",
  "uploading",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
]);

// Platform-neutral visibility. YouTube maps these to its privacyStatus values;
// other platforms map them to their nearest equivalent at the provider edge.
export const publicationVisibilityEnum = pgEnum("publication_visibility", [
  "private",
  "unlisted",
  "public",
  "platform_default",
]);

// Whether a generated thumbnail bakes a short headline into the image or is
// rendered text-free so a headline can be overlaid later.
export const thumbnailTextModeEnum = pgEnum("thumbnail_text_mode", [
  "baked",
  "clean",
]);

export const usageEventTypeEnum = pgEnum("usage_event_type", [
  "reserved",
  "reconciled",
  "released",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "workspace_created",
  "role_changed",
  "project_archived",
  "project_restored",
  "project_deleted",
  "script_restored",
  "scene_approved",
  "asset_approved",
  "generation_started",
  "generation_cancelled",
  "render_started",
  "export_deleted",
  "thumbnail_deleted",
  "budget_changed",
  "limits_changed",
  "platform_connected",
  "platform_disconnected",
  "video_published",
  "media_asset_deleted",
  "social_post_published",
  "social_post_scheduled",
  "social_post_deleted",
  "member_invited",
  "invitation_revoked",
  "member_joined",
  "member_removed",
  "marketing_skill_deleted",
  "custom_voice_created",
  "custom_voice_revoked",
  "google_business_connected",
  "google_business_synced",
  "google_business_disconnected",
  "storage_reconciled",
]);

export const userThemePreferenceEnum = pgEnum("user_theme_preference", [
  "light",
  "dim",
  "dark",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    themePreference: userThemePreferenceEnum("theme_preference")
      .notNull()
      .default("light"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
    index("users_email_index").on(table.email),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspaces_slug_unique").on(table.slug),
    index("workspaces_created_by_user_index").on(table.createdByUserId),
  ],
);

/** Per-user inbox state only; workflow state remains in its authoritative table. */
export const activityAcknowledgements = pgTable(
  "activity_acknowledgements",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityKey: text("activity_key").notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.userId, table.activityKey],
      name: "activity_acknowledgements_primary_key",
    }),
    index("activity_acknowledgements_user_index").on(
      table.workspaceId,
      table.userId,
      table.acknowledgedAt,
    ),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: workspaceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_unique").on(
      table.workspaceId,
      table.userId,
    ),
    index("workspace_members_user_index").on(table.userId),
    index("workspace_members_workspace_role_index").on(
      table.workspaceId,
      table.role,
    ),
  ],
);

export const workspaceInvitationStatusEnum = pgEnum(
  "workspace_invitation_status",
  ["pending", "accepted", "revoked", "expired"],
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRoleEnum("role").notNull(),
    status: workspaceInvitationStatusEnum("status")
      .notNull()
      .default("pending"),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    /** Clerk's invitation id, needed to call `revokeInvitation`. */
    clerkInvitationId: text("clerk_invitation_id"),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("workspace_invitations_workspace_status_index").on(
      table.workspaceId,
      table.status,
    ),
    uniqueIndex("workspace_invitations_workspace_email_pending_unique")
      .on(table.workspaceId, table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const storageObjects = pgTable(
  "storage_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: storageObjectKindEnum("kind").notNull(),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    etag: text("etag"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("storage_objects_object_key_unique").on(table.objectKey),
    uniqueIndex("storage_objects_workspace_kind_unique").on(
      table.workspaceId,
      table.kind,
    ),
    index("storage_objects_workspace_index").on(table.workspaceId),
  ],
);

/**
 * The workspace media library: reusable images and videos uploaded by hand, kept
 * so a social post can attach them later.
 *
 * Deliberately NOT stored in `storage_objects`. That table carries a
 * `(workspace_id, kind)` unique index — it holds at most one row per kind per
 * workspace and exists to track the workspace logo, not to be an asset store.
 *
 * Rows are soft deleted (`deletedAt`) rather than removed, because
 * `social_post_media` references them and a post that already went out must keep
 * showing what it actually sent.
 */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: mediaAssetKindEnum("kind").notNull(),
    status: mediaAssetStatusEnum("status").notNull().default("pending"),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    /** As supplied by the browser, sanitized. Display only — never a storage key. */
    originalFileName: text("original_file_name").notNull().default(""),
    /** Editable label; falls back to the file name in the UI when empty. */
    title: text("title").notNull().default(""),
    /** Accessibility text carried through to platforms that accept it. */
    altText: text("alt_text").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** Measured server-side with sharp for images; null for video. */
    width: integer("width"),
    height: integer("height"),
    /**
     * Client-reported for video — the web runtime has no ffprobe, so this is a
     * hint used for display and pre-flight only. Platform duration rules are
     * enforced at publish time by each provider, as they are for renders.
     */
    durationMilliseconds: integer("duration_milliseconds"),
    inspectionStatus: mediaInspectionStatusEnum("inspection_status"),
    verifiedMetadata: jsonb("verified_metadata").$type<VerifiedMediaMetadata>(),
    inspectionWarnings: jsonb("inspection_warnings")
      .$type<string[]>()
      .notNull()
      .default([]),
    inspectionTriggerRunId: text("inspection_trigger_run_id"),
    inspectionError: text("inspection_error"),
    inspectedAt: timestamp("inspected_at", { withTimezone: true }),
    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("media_assets_object_key_unique").on(table.objectKey),
    uniqueIndex("media_assets_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("media_assets_workspace_kind_index").on(
      table.workspaceId,
      table.kind,
      table.createdAt,
    ),
    index("media_assets_workspace_status_index").on(
      table.workspaceId,
      table.status,
    ),
    check(
      "media_assets_dimensions_non_negative",
      sql`(${table.width} is null or ${table.width} > 0) and (${table.height} is null or ${table.height} > 0) and (${table.durationMilliseconds} is null or ${table.durationMilliseconds} >= 0)`,
    ),
  ],
);

export const characters = pgTable(
  "characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    visualIdentity: text("visual_identity").notNull().default(""),
    bodyProportions: text("body_proportions").notNull().default(""),
    faceDescription: text("face_description").notNull().default(""),
    hairDescription: text("hair_description").notNull().default(""),
    skinToneDescription: text("skin_tone_description").notNull().default(""),
    defaultOutfitDescription: text("default_outfit_description")
      .notNull()
      .default(""),
    personalityNotes: text("personality_notes").notNull().default(""),
    continuityRules: text("continuity_rules").notNull().default(""),
    negativeConstraints: text("negative_constraints").notNull().default(""),
    status: characterStatusEnum("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("characters_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("characters_workspace_slug_unique").on(
      table.workspaceId,
      table.slug,
    ),
    index("characters_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
  ],
);

export const characterReferenceAssets = pgTable(
  "character_reference_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    type: characterReferenceTypeEnum("type").notNull(),
    source: characterReferenceSourceEnum("source")
      .notNull()
      .default("uploaded"),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    etag: text("etag"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("character_reference_assets_id_character_workspace_unique").on(
      table.id,
      table.characterId,
      table.workspaceId,
    ),
    uniqueIndex("character_reference_assets_object_key_unique").on(
      table.objectKey,
    ),
    uniqueIndex("character_reference_assets_single_view_unique")
      .on(table.characterId, table.type)
      .where(
        sql`${table.type} in ('master', 'front', 'threeQuarter', 'side', 'fullBody', 'poseIdle', 'poseTalkOpen', 'poseTalkClosed', 'poseBlink')`,
      ),
    index("character_reference_assets_workspace_character_index").on(
      table.workspaceId,
      table.characterId,
      table.createdAt,
    ),
    check(
      "character_reference_assets_size_positive",
      sql`${table.sizeBytes} > 0`,
    ),
    check(
      "character_reference_assets_dimensions_positive",
      sql`${table.width} > 0 and ${table.height} > 0`,
    ),
  ],
);

export const characterAuditEvents = pgTable(
  "character_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    referenceAssetId: uuid("reference_asset_id"),
    action: characterAuditActionEnum("action").notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("character_audit_events_workspace_character_index").on(
      table.workspaceId,
      table.characterId,
      table.createdAt,
    ),
  ],
);

// Workspace-scoped, self-contained record for generating a character reference
// portrait. Portraits belong to a character, not a project, so their spend is
// tracked here (estimated/actual cost + status) rather than on the
// project-scoped `usage_reservations` ledger.
export const characterReferenceGenerations = pgTable(
  "character_reference_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    referenceType: characterReferenceTypeEnum("reference_type").notNull(),
    status: characterReferenceGenerationStatusEnum("status")
      .notNull()
      .default("queued"),
    model: text("model").notNull(),
    size: text("size").notNull(),
    quality: text("quality").notNull(),
    outputFormat: text("output_format").notNull(),
    outputCompression: integer("output_compression").notNull(),
    background: text("background").notNull(),
    finalPrompt: text("final_prompt").notNull(),
    promptTemplateVersion: text("prompt_template_version").notNull(),
    promptTemplateVersionId: uuid("prompt_template_version_id")
      .notNull()
      .references(() => promptTemplateVersions.id, { onDelete: "restrict" }),
    requestNonce: text("request_nonce").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    resultReferenceAssetId: uuid("result_reference_asset_id"),
    providerRequestId: text("provider_request_id"),
    triggerRunId: text("trigger_run_id"),
    safeErrorMessage: text("safe_error_message"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("character_reference_generations_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("character_reference_generations_workspace_nonce_unique").on(
      table.workspaceId,
      table.requestNonce,
    ),
    index("character_reference_generations_character_index").on(
      table.workspaceId,
      table.characterId,
      table.createdAt,
    ),
    index("character_reference_generations_status_index").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    check(
      "character_reference_generations_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "character_reference_generations_progress_range",
      sql`${table.progressPercent} between 0 and 100`,
    ),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: projectStatusEnum("status").notNull().default("draft"),
    videoKind: projectVideoKindEnum("video_kind")
      .notNull()
      .default("staticImages"),
    aspectRatio: projectAspectRatioEnum("aspect_ratio").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    framesPerSecond: integer("frames_per_second").notNull(),
    language: text("language").notNull(),
    maximumBudgetCents: integer("maximum_budget_cents").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("projects_id_workspace_unique").on(table.id, table.workspaceId),
    index("projects_workspace_status_updated_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    index("projects_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    check("projects_width_positive", sql`${table.width} > 0`),
    check("projects_height_positive", sql`${table.height} > 0`),
    check(
      "projects_fps_valid",
      sql`${table.framesPerSecond} between 1 and 120`,
    ),
    check("projects_budget_nonnegative", sql`${table.maximumBudgetCents} >= 0`),
  ],
);

/**
 * A format-specific view of one source project. Variants deliberately reference
 * the same script, scenes, approved audio, captions, and source images; only
 * presentation decisions that differ by output format live here.
 */
export const projectOutputVariants = pgTable(
  "project_output_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    aspectRatio: projectAspectRatioEnum("aspect_ratio").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    status: outputVariantStatusEnum("status").notNull().default("draft"),
    captionStyle: jsonb("caption_style").$type<CaptionStyleData>(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_output_variants_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("project_output_variants_project_aspect_unique").on(
      table.projectId,
      table.aspectRatio,
    ),
    index("project_output_variants_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.updatedAt,
    ),
    check("project_output_variants_width_positive", sql`${table.width} > 0`),
    check("project_output_variants_height_positive", sql`${table.height} > 0`),
    check(
      "project_output_variants_dimensions_match_aspect",
      sql`(${table.aspectRatio} = '16:9' and ${table.width} = 1920 and ${table.height} = 1080)
        or (${table.aspectRatio} = '9:16' and ${table.width} = 1080 and ${table.height} = 1920)
        or (${table.aspectRatio} = '1:1' and ${table.width} = 1080 and ${table.height} = 1080)`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "project_output_variants_tenant_project_fkey",
    }).onDelete("cascade"),
  ],
);

export const projectScriptDrafts = pgTable(
  "project_script_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    revision: integer("revision").notNull().default(0),
    characterCount: integer("character_count").notNull().default(0),
    estimatedNarrationDurationSeconds: integer(
      "estimated_narration_duration_seconds",
    )
      .notNull()
      .default(0),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_script_drafts_project_unique").on(table.projectId),
    index("project_script_drafts_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
    ),
    check(
      "project_script_drafts_revision_nonnegative",
      sql`${table.revision} >= 0`,
    ),
    check(
      "project_script_drafts_character_count_nonnegative",
      sql`${table.characterCount} >= 0`,
    ),
  ],
);

export const projectScriptVersions = pgTable(
  "project_script_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    content: text("content").notNull(),
    characterCount: integer("character_count").notNull(),
    estimatedNarrationDurationSeconds: integer(
      "estimated_narration_duration_seconds",
    ).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    restoredFromVersionId: uuid("restored_from_version_id"),
    status: scriptVersionStatusEnum("status").notNull().default("draft"),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    deletedByUserId: uuid("deleted_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_script_versions_project_number_unique").on(
      table.projectId,
      table.versionNumber,
    ),
    index("project_script_versions_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    uniqueIndex("project_script_versions_one_approved_unique")
      .on(table.projectId)
      .where(sql`${table.status} = 'approved'`),
    check(
      "project_script_versions_number_positive",
      sql`${table.versionNumber} > 0`,
    ),
    check(
      "project_script_versions_character_count_nonnegative",
      sql`${table.characterCount} >= 0`,
    ),
    foreignKey({
      columns: [table.restoredFromVersionId],
      foreignColumns: [table.id],
      name: "project_script_versions_restored_from_fkey",
    }).onDelete("set null"),
  ],
);

// One editable content brief per project — the subject/audience/tone/platform
// input that AI script, title, and thumbnail generation read from.
export const projectBriefs = pgTable(
  "project_briefs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    topic: text("topic").notNull().default(""),
    targetAudience: text("target_audience").notNull().default(""),
    tone: text("tone").notNull().default(""),
    targetDurationSeconds: integer("target_duration_seconds"),
    primaryPlatform: contentPlatformEnum("primary_platform")
      .notNull()
      .default("youtube"),
    hookAngle: text("hook_angle").notNull().default(""),
    // Free-text content niche (e.g. "History", "Personal finance"), carried
    // over from an applied Idea Lab idea or set directly. Drives generation
    // heuristics — e.g. a historical niche requires factual-accuracy mode in
    // script generation — so it stays on the project, not just the idea.
    niche: text("niche").notNull().default(""),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_briefs_project_unique").on(table.projectId),
    index("project_briefs_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
    ),
    check(
      "project_briefs_duration_positive",
      sql`${table.targetDurationSeconds} is null or ${table.targetDurationSeconds} > 0`,
    ),
  ],
);

// How a saved content idea originated: produced by the AI idea generator, or
// typed in by hand.
export const contentIdeaSourceEnum = pgEnum("content_idea_source", [
  "ai",
  "manual",
]);

// Idea Lab niche-ideation run. Deliberately OFF the usage-reservation ledger
// (like platform publishing): a one-shot text call costs a fraction of a cent,
// so this table just records actual spend for visibility rather than reserving
// budget up front. Synchronous — the row is written after the provider returns.
export const contentIdeaGenerationRuns = pgTable(
  "content_idea_generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    niche: text("niche").notNull(),
    platform: contentPlatformEnum("platform"),
    tonePreference: text("tone_preference"),
    language: text("language").notNull().default("English"),
    requestedCount: integer("requested_count").notNull(),
    resultCount: integer("result_count"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    finalPrompt: text("final_prompt").notNull(),
    status: sceneAnalysisStatusEnum("status").notNull().default("completed"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    actualCostCents: integer("actual_cost_cents"),
    providerRequestId: text("provider_request_id"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("content_idea_generation_runs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "content_idea_generation_runs_count_positive",
      sql`${table.requestedCount} > 0`,
    ),
    check(
      "content_idea_generation_runs_cost_nonnegative",
      sql`${table.actualCostCents} is null or ${table.actualCostCents} >= 0`,
    ),
  ],
);

// A saved content idea: a pre-project brief, grouped by niche and workspace
// scoped. Carries exactly the fields `project_briefs` needs so "use this idea"
// is a direct copy into a project's brief.
export const contentIdeas = pgTable(
  "content_ideas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    generationRunId: uuid("generation_run_id").references(
      () => contentIdeaGenerationRuns.id,
      { onDelete: "set null" },
    ),
    niche: text("niche").notNull(),
    topic: text("topic").notNull().default(""),
    targetAudience: text("target_audience").notNull().default(""),
    tone: text("tone").notNull().default(""),
    targetDurationSeconds: integer("target_duration_seconds"),
    primaryPlatform: contentPlatformEnum("primary_platform")
      .notNull()
      .default("youtube"),
    hookAngle: text("hook_angle").notNull().default(""),
    rationale: text("rationale").notNull().default(""),
    hookType: text("hook_type").notNull().default(""),
    source: contentIdeaSourceEnum("source").notNull().default("ai"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("content_ideas_workspace_niche_index").on(
      table.workspaceId,
      table.niche,
    ),
    index("content_ideas_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "content_ideas_duration_positive",
      sql`${table.targetDurationSeconds} is null or ${table.targetDurationSeconds} > 0`,
    ),
  ],
);

// Money-safe AI script-generation run (project-scoped, on the usage ledger).
export const scriptGenerationRuns = pgTable(
  "script_generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    finalPrompt: text("final_prompt").notNull(),
    status: sceneAnalysisStatusEnum("status").notNull().default("pending"),
    progressPercent: integer("progress_percent").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    generatedContent: text("generated_content"),
    suggestedTitle: text("suggested_title"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("script_generation_runs_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("script_generation_runs_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    check(
      "script_generation_runs_progress_valid",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "script_generation_runs_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
  ],
);

// Money-safe AI platform-title-generation run (project-scoped, on the usage
// ledger). Each run targets one distribution platform and produces N ranked
// title options (stored in `project_title_suggestions`).
export const titleGenerationRuns = pgTable(
  "title_generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    platform: contentPlatformEnum("platform").notNull(),
    scriptVersionId: uuid("script_version_id").references(
      () => projectScriptVersions.id,
      { onDelete: "set null" },
    ),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    finalPrompt: text("final_prompt").notNull(),
    requestedOptionCount: integer("requested_option_count").notNull(),
    status: sceneAnalysisStatusEnum("status").notNull().default("pending"),
    progressPercent: integer("progress_percent").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    resultOptionCount: integer("result_option_count"),
    generatedDescription: text("generated_description"),
    generatedTags: jsonb("generated_tags").$type<string[]>(),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("title_generation_runs_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("title_generation_runs_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("title_generation_runs_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    check(
      "title_generation_runs_option_count_positive",
      sql`${table.requestedOptionCount} > 0`,
    ),
    check(
      "title_generation_runs_progress_valid",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "title_generation_runs_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "title_generation_runs_tenant_project_fkey",
    }).onDelete("cascade"),
  ],
);

// One generated title option, produced by a `title_generation_runs` row. Users
// favorite and copy the best options; this is durable output, not billing state.
export const projectTitleSuggestions = pgTable(
  "project_title_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    titleGenerationRunId: uuid("title_generation_run_id").notNull(),
    platform: contentPlatformEnum("platform").notNull(),
    text: text("text").notNull(),
    rationale: text("rationale").notNull().default(""),
    hookType: text("hook_type").notNull().default(""),
    position: integer("position").notNull(),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_title_suggestions_run_position_unique").on(
      table.titleGenerationRunId,
      table.position,
    ),
    index("project_title_suggestions_workspace_project_platform_index").on(
      table.workspaceId,
      table.projectId,
      table.platform,
      table.createdAt,
    ),
    check(
      "project_title_suggestions_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "project_title_suggestions_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.titleGenerationRunId, table.workspaceId],
      foreignColumns: [titleGenerationRuns.id, titleGenerationRuns.workspaceId],
      name: "project_title_suggestions_tenant_run_fkey",
    }).onDelete("cascade"),
  ],
);

// One generated publish thumbnail. Project-scoped and billable, so it carries the
// same reservation/idempotency/provider bookkeeping as scene images, plus the R2
// asset pointer. `promptTemplateVersionId` pins the image prompt for
// reproducibility (image prompts are source-hash gated, unlike text prompts).
export const thumbnailGenerations = pgTable(
  "thumbnail_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    platform: contentPlatformEnum("platform").notNull(),
    textMode: thumbnailTextModeEnum("text_mode").notNull(),
    headlineText: text("headline_text"),
    scriptVersionId: uuid("script_version_id").references(
      () => projectScriptVersions.id,
      { onDelete: "set null" },
    ),
    promptTemplateVersionId: uuid("prompt_template_version_id")
      .notNull()
      .references(() => promptTemplateVersions.id, { onDelete: "restrict" }),
    promptTemplateVersion: text("prompt_template_version").notNull(),
    finalPrompt: text("final_prompt").notNull(),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    model: text("model").notNull(),
    quality: imageQualityEnum("quality").notNull(),
    size: text("size").notNull(),
    outputFormat: imageOutputFormatEnum("output_format").notNull(),
    outputCompression: integer("output_compression").notNull(),
    background: text("background").notNull().default("opaque"),
    status: imageGenerationStatusEnum("status").notNull().default("pending"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    assetObjectKey: text("asset_object_key"),
    assetContentType: text("asset_content_type"),
    assetSizeBytes: integer("asset_size_bytes"),
    assetWidth: integer("asset_width"),
    assetHeight: integer("asset_height"),
    assetEtag: text("asset_etag"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    // Hides a dead generation from the gallery without deleting the row. The
    // reservation FK cascades on delete, so removing a charged failure would
    // erase real spend from the ledger — dismissal is always a soft hide.
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("thumbnail_generations_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("thumbnail_generations_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("thumbnail_generations_workspace_project_platform_index").on(
      table.workspaceId,
      table.projectId,
      table.platform,
      table.createdAt,
    ),
    check(
      "thumbnail_generations_progress_valid",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "thumbnail_generations_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "thumbnail_generations_size_supported",
      sql`${table.size} in ('1536x1024', '1024x1536', '1024x1024')`,
    ),
    check(
      "thumbnail_generations_headline_matches_text_mode",
      sql`(${table.textMode} = 'baked' and ${table.headlineText} is not null and length(btrim(${table.headlineText})) > 0) or (${table.textMode} = 'clean' and ${table.headlineText} is null)`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "thumbnail_generations_tenant_project_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * A workspace's authorized account on an external platform (a YouTube channel
 * today; a Facebook page, Instagram account, or TikTok account later).
 *
 * Tokens are stored sealed by `lib/crypto/secret-box` and are never selected
 * into a view model — only the publish worker opens them. Connections are
 * workspace-scoped, not user-scoped, so a channel stays connected when the
 * member who linked it leaves.
 */
export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: contentPlatformEnum("platform").notNull(),
    /** The platform's own account identifier (YouTube channel id). */
    externalAccountId: text("external_account_id").notNull(),
    externalAccountName: text("external_account_name").notNull().default(""),
    externalAccountUrl: text("external_account_url"),
    accessTokenSealed: text("access_token_sealed").notNull(),
    /** Null when the platform issues no refresh token (re-consent required). */
    refreshTokenSealed: text("refresh_token_sealed"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    scopes: text("scopes").notNull().default(""),
    status: platformConnectionStatusEnum("status").notNull().default("active"),
    lastError: text("last_error"),
    connectedByUserId: uuid("connected_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("platform_connections_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    // One live connection per external account per workspace; re-authorizing the
    // same channel updates the row instead of accumulating duplicates.
    uniqueIndex("platform_connections_workspace_account_unique").on(
      table.workspaceId,
      table.platform,
      table.externalAccountId,
    ),
    index("platform_connections_workspace_platform_index").on(
      table.workspaceId,
      table.platform,
      table.status,
    ),
  ],
);

export const sceneAnalysisRuns = pgTable(
  "scene_analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scriptVersionId: uuid("script_version_id")
      .notNull()
      .references(() => projectScriptVersions.id, { onDelete: "restrict" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    finalPrompt: text("final_prompt").notNull(),
    status: sceneAnalysisStatusEnum("status").notNull().default("pending"),
    progressPercent: integer("progress_percent").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_analysis_runs_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("scene_analysis_runs_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    check(
      "scene_analysis_runs_progress_valid",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "scene_analysis_runs_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0`,
    ),
  ],
);

export const scenes = pgTable(
  "scenes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    scriptVersionId: uuid("script_version_id")
      .notNull()
      .references(() => projectScriptVersions.id, { onDelete: "restrict" }),
    analysisRunId: uuid("analysis_run_id")
      .notNull()
      .references(() => sceneAnalysisRuns.id, { onDelete: "cascade" }),
    sceneNumber: integer("scene_number").notNull(),
    status: sceneStatusEnum("status").notNull().default("draft"),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scenes_id_project_workspace_unique").on(
      table.id,
      table.projectId,
      table.workspaceId,
    ),
    uniqueIndex("scenes_analysis_number_unique").on(
      table.analysisRunId,
      table.sceneNumber,
    ),
    index("scenes_workspace_project_number_index").on(
      table.workspaceId,
      table.projectId,
      table.sceneNumber,
    ),
    check("scenes_number_positive", sql`${table.sceneNumber} > 0`),
    check("scenes_version_positive", sql`${table.currentVersion} > 0`),
  ],
);

export const sceneVersions = pgTable(
  "scene_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    narrationText: text("narration_text").notNull(),
    visualDescription: text("visual_description").notNull(),
    locationDescription: text("location_description").notNull(),
    actionDescription: text("action_description").notNull(),
    cameraShot: text("camera_shot").notNull(),
    cameraAngle: text("camera_angle").notNull(),
    cameraMotion: text("camera_motion").notNull(),
    emotionalTone: text("emotional_tone").notNull(),
    characterNames: jsonb("character_names").$type<string[]>().notNull(),
    propNames: jsonb("prop_names").$type<string[]>().notNull(),
    continuityNotes: text("continuity_notes").notNull(),
    estimatedDurationMilliseconds: integer(
      "estimated_duration_milliseconds",
    ).notNull(),
    startTimeMilliseconds: integer("start_time_milliseconds").notNull(),
    endTimeMilliseconds: integer("end_time_milliseconds").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_versions_id_scene_project_workspace_unique").on(
      table.id,
      table.sceneId,
      table.projectId,
      table.workspaceId,
    ),
    uniqueIndex("scene_versions_scene_number_unique").on(
      table.sceneId,
      table.versionNumber,
    ),
    index("scene_versions_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.sceneId,
    ),
    check(
      "scene_versions_duration_positive",
      sql`${table.estimatedDurationMilliseconds} > 0`,
    ),
    check(
      "scene_versions_timing_valid",
      sql`${table.startTimeMilliseconds} >= 0 and ${table.endTimeMilliseconds} > ${table.startTimeMilliseconds}`,
    ),
  ],
);

export const sceneVersionCharacters = pgTable(
  "scene_version_characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sceneVersionId: uuid("scene_version_id")
      .notNull()
      .references(() => sceneVersions.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "restrict" }),
    // Staging for animated projects. Both are ignored by static-image projects,
    // which is why they carry defaults rather than being nullable — every
    // existing assignment stays valid and simply centers with no speaker.
    stageSlot: sceneCharacterStageSlotEnum("stage_slot")
      .notNull()
      .default("center"),
    isSpeaker: boolean("is_speaker").notNull().default(false),
    assignedByUserId: uuid("assigned_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_version_characters_version_character_unique").on(
      table.sceneVersionId,
      table.characterId,
    ),
    // One scene is one narration clip, so at most one character can be speaking
    // it. Enforced in the database because the lip-sync envelope is attached to
    // exactly one character at render time and a second speaker would silently
    // pick a winner by row order.
    uniqueIndex("scene_version_characters_single_speaker_unique")
      .on(table.sceneVersionId)
      .where(sql`${table.isSpeaker}`),
    index("scene_version_characters_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.sceneVersionId,
    ),
    index("scene_version_characters_character_index").on(table.characterId),
  ],
);

// The durable project "cast": which characters a project uses. Survives scene
// re-analysis (which creates new `sceneVersions`) so the roster can be
// re-applied to freshly generated scene versions.
export const projectCharacters = pgTable(
  "project_characters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    addedByUserId: uuid("added_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_characters_project_character_unique").on(
      table.projectId,
      table.characterId,
    ),
    index("project_characters_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
    ),
    index("project_characters_character_index").on(table.characterId),
  ],
);

export const stylePresets = pgTable(
  "style_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("style_presets_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("style_presets_workspace_slug_unique").on(
      table.workspaceId,
      table.slug,
    ),
    uniqueIndex("style_presets_workspace_default_unique")
      .on(table.workspaceId)
      .where(sql`${table.isDefault} = true and ${table.archivedAt} is null`),
    index("style_presets_workspace_archived_index").on(
      table.workspaceId,
      table.archivedAt,
      table.createdAt,
    ),
  ],
);

export const stylePresetVersions = pgTable(
  "style_preset_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stylePresetId: uuid("style_preset_id").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    positivePrompt: text("positive_prompt").notNull(),
    negativePrompt: text("negative_prompt").notNull(),
    defaultAspectRatio: projectAspectRatioEnum("default_aspect_ratio")
      .notNull()
      .default("16:9"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("style_preset_versions_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("style_preset_versions_preset_version_unique").on(
      table.stylePresetId,
      table.version,
    ),
    index("style_preset_versions_workspace_preset_index").on(
      table.workspaceId,
      table.stylePresetId,
      table.version,
    ),
    check("style_preset_versions_version_positive", sql`${table.version} > 0`),
    foreignKey({
      columns: [table.stylePresetId, table.workspaceId],
      foreignColumns: [stylePresets.id, stylePresets.workspaceId],
      name: "style_preset_versions_tenant_preset_fkey",
    }).onDelete("cascade"),
  ],
);

export const promptTemplateVersions = pgTable(
  "prompt_template_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateKey: text("template_key").notNull(),
    version: text("version").notNull(),
    sourceHash: text("source_hash").notNull(),
    templateSource: text("template_source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("prompt_template_versions_key_version_unique").on(
      table.templateKey,
      table.version,
    ),
  ],
);

export const sceneImageBatches = pgTable(
  "scene_image_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    status: sceneImageBatchStatusEnum("status").notNull().default("pending"),
    requestNonce: uuid("request_nonce").notNull(),
    stylePresetVersionId: uuid("style_preset_version_id").notNull(),
    quality: imageQualityEnum("quality").notNull(),
    // The distinct sizes requested across this batch (one generation row per
    // scene x size is created; this records which sizes the batch spans).
    sizes: text("sizes").array().notNull(),
    // Total images requested/reserved across the batch (scenes x sizes), not
    // the scene count alone, once a batch can span multiple sizes.
    requestedSceneCount: integer("requested_scene_count").notNull(),
    reservedSceneCount: integer("reserved_scene_count").notNull().default(0),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_image_batches_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("scene_image_batches_workspace_request_nonce_unique").on(
      table.workspaceId,
      table.requestNonce,
    ),
    index("scene_image_batches_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    check(
      "scene_image_batches_scene_count_positive",
      sql`${table.requestedSceneCount} > 0`,
    ),
    check(
      "scene_image_batches_reserved_count_nonnegative",
      sql`${table.reservedSceneCount} >= 0`,
    ),
    check(
      "scene_image_batches_estimated_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0`,
    ),
    check(
      "scene_image_batches_sizes_supported",
      sql`array_length(${table.sizes}, 1) > 0 and ${table.sizes} <@ array['1536x1024', '1024x1536', '1024x1024']::text[]`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "scene_image_batches_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.stylePresetVersionId, table.workspaceId],
      foreignColumns: [stylePresetVersions.id, stylePresetVersions.workspaceId],
      name: "scene_image_batches_tenant_style_fkey",
    }).onDelete("restrict"),
  ],
);

export const sceneImageGenerations = pgTable(
  "scene_image_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    sceneId: uuid("scene_id").notNull(),
    sceneVersionId: uuid("scene_version_id").notNull(),
    purpose: imageGenerationPurposeEnum("purpose").notNull().default("scene"),
    source: imageGenerationSourceEnum("source")
      .notNull()
      .default("ai_generated"),
    outputVariantId: uuid("output_variant_id"),
    sourceImageGenerationId: uuid("source_image_generation_id"),
    stylePresetVersionId: uuid("style_preset_version_id"),
    promptTemplateVersionId: uuid("prompt_template_version_id").references(
      () => promptTemplateVersions.id,
      { onDelete: "restrict" },
    ),
    generationVersion: integer("generation_version").notNull(),
    requestNonce: uuid("request_nonce").notNull(),
    status: imageGenerationStatusEnum("status").notNull().default("pending"),
    reviewStatus: imageReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    batchId: uuid("batch_id"),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key"),
    requestFingerprint: text("request_fingerprint"),
    model: text("model"),
    quality: imageQualityEnum("quality"),
    size: text("size").notNull(),
    outputFormat: imageOutputFormatEnum("output_format").notNull(),
    outputCompression: integer("output_compression"),
    background: text("background").notNull().default("opaque"),
    inputFidelity: text("input_fidelity"),
    promptTemplateVersion: text("prompt_template_version"),
    stylePresetVersion: integer("style_preset_version"),
    finalPrompt: text("final_prompt"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    assetObjectKey: text("asset_object_key"),
    assetContentType: text("asset_content_type"),
    assetSizeBytes: integer("asset_size_bytes"),
    assetWidth: integer("asset_width"),
    assetHeight: integer("asset_height"),
    assetEtag: text("asset_etag"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_image_generations_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("scene_image_generations_id_project_workspace_unique").on(
      table.id,
      table.projectId,
      table.workspaceId,
    ),
    uniqueIndex("scene_image_generations_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("scene_image_generations_version_unique").on(
      table.sceneVersionId,
      table.generationVersion,
    ),
    uniqueIndex("scene_image_generations_workspace_request_nonce_unique").on(
      table.workspaceId,
      table.requestNonce,
    ),
    // One approved image PER SIZE per scene version — a scene can have up to
    // three simultaneously-approved images (one per size), not just one.
    uniqueIndex("scene_image_generations_approved_scene_version_size_unique")
      .on(table.sceneVersionId, table.size)
      .where(sql`${table.reviewStatus} = 'approved'`),
    index("scene_image_generations_workspace_project_scene_index").on(
      table.workspaceId,
      table.projectId,
      table.sceneId,
      table.createdAt,
    ),
    index("scene_image_generations_status_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    index("scene_image_generations_style_preset_version_index").on(
      table.stylePresetVersionId,
    ),
    check(
      "scene_image_generations_version_positive",
      sql`${table.generationVersion} > 0`,
    ),
    check(
      "scene_image_generations_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "scene_image_generations_progress_range",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "scene_image_generations_compression_range",
      sql`${table.outputCompression} is null or ${table.outputCompression} between 1 and 100`,
    ),
    check(
      "scene_image_generations_background_supported",
      sql`${table.background} in ('opaque', 'auto')`,
    ),
    check(
      "scene_image_generations_size_supported",
      sql`${table.size} in ('1536x1024', '1024x1536', '1024x1024')`,
    ),
    check(
      "scene_image_generations_approved_succeeded",
      sql`${table.reviewStatus} <> 'approved' or ${table.status} = 'succeeded'`,
    ),
    check(
      "scene_image_generations_variant_outpaint_fields",
      sql`(${table.purpose} = 'scene' and ${table.outputVariantId} is null and ${table.sourceImageGenerationId} is null) or (${table.purpose} = 'variant_outpaint' and ${table.outputVariantId} is not null and ${table.sourceImageGenerationId} is not null and ${table.reviewStatus} = 'pending')`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "scene_image_generations_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sceneId, table.projectId, table.workspaceId],
      foreignColumns: [scenes.id, scenes.projectId, scenes.workspaceId],
      name: "scene_image_generations_tenant_scene_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.sceneVersionId,
        table.sceneId,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [
        sceneVersions.id,
        sceneVersions.sceneId,
        sceneVersions.projectId,
        sceneVersions.workspaceId,
      ],
      name: "scene_image_generations_tenant_version_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.stylePresetVersionId, table.workspaceId],
      foreignColumns: [stylePresetVersions.id, stylePresetVersions.workspaceId],
      name: "scene_image_generations_tenant_style_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.outputVariantId, table.workspaceId],
      foreignColumns: [
        projectOutputVariants.id,
        projectOutputVariants.workspaceId,
      ],
      name: "scene_image_generations_tenant_output_variant_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.sourceImageGenerationId,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [table.id, table.projectId, table.workspaceId],
      name: "scene_image_generations_tenant_source_generation_fkey",
    }).onDelete("restrict"),
    index("scene_image_generations_batch_index").on(
      table.workspaceId,
      table.batchId,
    ),
    foreignKey({
      columns: [table.batchId, table.workspaceId],
      foreignColumns: [sceneImageBatches.id, sceneImageBatches.workspaceId],
      name: "scene_image_generations_tenant_batch_fkey",
    }).onDelete("set null"),
  ],
);

/**
 * Non-destructive framing instructions for displaying an approved source image
 * in one output variant. Percentages use basis points (0..10000) to avoid
 * floating-point drift across browser previews and deterministic renders.
 */
export const sceneVariantFramings = pgTable(
  "scene_variant_framings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    outputVariantId: uuid("output_variant_id").notNull(),
    sceneId: uuid("scene_id").notNull(),
    sceneVersionId: uuid("scene_version_id").notNull(),
    sourceImageGenerationId: uuid("source_image_generation_id").notNull(),
    mode: sceneFramingModeEnum("mode").notNull().default("cover"),
    focalPointXBps: integer("focal_point_x_bps").notNull().default(5000),
    focalPointYBps: integer("focal_point_y_bps").notNull().default(5000),
    scaleBps: integer("scale_bps").notNull().default(10000),
    backgroundColor: text("background_color").notNull().default("#000000"),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_variant_framings_variant_scene_version_unique").on(
      table.outputVariantId,
      table.sceneVersionId,
    ),
    index("scene_variant_framings_workspace_project_variant_index").on(
      table.workspaceId,
      table.projectId,
      table.outputVariantId,
    ),
    check(
      "scene_variant_framings_focal_x_range",
      sql`${table.focalPointXBps} between 0 and 10000`,
    ),
    check(
      "scene_variant_framings_focal_y_range",
      sql`${table.focalPointYBps} between 0 and 10000`,
    ),
    check(
      "scene_variant_framings_scale_range",
      sql`${table.scaleBps} between 10000 and 30000`,
    ),
    check(
      "scene_variant_framings_background_color_hex",
      sql`${table.backgroundColor} ~ '^#[0-9a-fA-F]{6}$'`,
    ),
    foreignKey({
      columns: [table.outputVariantId, table.workspaceId],
      foreignColumns: [
        projectOutputVariants.id,
        projectOutputVariants.workspaceId,
      ],
      name: "scene_variant_framings_tenant_variant_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sceneId, table.projectId, table.workspaceId],
      foreignColumns: [scenes.id, scenes.projectId, scenes.workspaceId],
      name: "scene_variant_framings_tenant_scene_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.sceneVersionId,
        table.sceneId,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [
        sceneVersions.id,
        sceneVersions.sceneId,
        sceneVersions.projectId,
        sceneVersions.workspaceId,
      ],
      name: "scene_variant_framings_tenant_scene_version_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.sourceImageGenerationId,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [
        sceneImageGenerations.id,
        sceneImageGenerations.projectId,
        sceneImageGenerations.workspaceId,
      ],
      name: "scene_variant_framings_tenant_source_image_fkey",
    }).onDelete("restrict"),
  ],
);

export const shortCompositions = pgTable(
  "short_compositions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    outputVariantId: uuid("output_variant_id").notNull(),
    name: text("name").notNull(),
    status: shortCompositionStatusEnum("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("short_compositions_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("short_compositions_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.updatedAt,
    ),
    check(
      "short_compositions_name_not_blank",
      sql`length(trim(${table.name})) > 0`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "short_compositions_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.outputVariantId, table.workspaceId],
      foreignColumns: [
        projectOutputVariants.id,
        projectOutputVariants.workspaceId,
      ],
      name: "short_compositions_tenant_variant_fkey",
    }).onDelete("restrict"),
  ],
);

export const shortClips = pgTable(
  "short_clips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    shortCompositionId: uuid("short_composition_id").notNull(),
    sourceSceneId: uuid("source_scene_id").notNull(),
    sourceSceneVersionId: uuid("source_scene_version_id").notNull(),
    position: integer("position").notNull(),
    sourceStartMilliseconds: integer("source_start_milliseconds").notNull(),
    sourceEndMilliseconds: integer("source_end_milliseconds").notNull(),
    transition: text("transition").notNull().default("cut"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("short_clips_composition_position_unique").on(
      table.shortCompositionId,
      table.position,
    ),
    index("short_clips_workspace_project_composition_index").on(
      table.workspaceId,
      table.projectId,
      table.shortCompositionId,
    ),
    check("short_clips_position_positive", sql`${table.position} > 0`),
    check(
      "short_clips_range_valid",
      sql`${table.sourceStartMilliseconds} >= 0 and ${table.sourceEndMilliseconds} > ${table.sourceStartMilliseconds}`,
    ),
    check(
      "short_clips_transition_supported",
      sql`${table.transition} in ('cut', 'fade')`,
    ),
    foreignKey({
      columns: [table.shortCompositionId, table.workspaceId],
      foreignColumns: [shortCompositions.id, shortCompositions.workspaceId],
      name: "short_clips_tenant_composition_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sourceSceneId, table.projectId, table.workspaceId],
      foreignColumns: [scenes.id, scenes.projectId, scenes.workspaceId],
      name: "short_clips_tenant_scene_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.sourceSceneVersionId,
        table.sourceSceneId,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [
        sceneVersions.id,
        sceneVersions.sceneId,
        sceneVersions.projectId,
        sceneVersions.workspaceId,
      ],
      name: "short_clips_tenant_scene_version_fkey",
    }).onDelete("restrict"),
  ],
);

export const generationReferenceAssets = pgTable(
  "generation_reference_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").notNull(),
    referenceAssetId: uuid("reference_asset_id").references(
      () => characterReferenceAssets.id,
      { onDelete: "set null" },
    ),
    referenceAssetIdSnapshot: uuid("reference_asset_id_snapshot").notNull(),
    characterId: uuid("character_id").notNull(),
    objectKeySnapshot: text("object_key_snapshot").notNull(),
    contentTypeSnapshot: text("content_type_snapshot").notNull(),
    etagSnapshot: text("etag_snapshot").notNull(),
    referenceTypeSnapshot: characterReferenceTypeEnum(
      "reference_type_snapshot",
    ).notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("generation_reference_assets_generation_reference_unique").on(
      table.generationId,
      table.referenceAssetIdSnapshot,
    ),
    uniqueIndex("generation_reference_assets_generation_position_unique").on(
      table.generationId,
      table.position,
    ),
    index("generation_reference_assets_workspace_generation_index").on(
      table.workspaceId,
      table.generationId,
    ),
    index("generation_reference_assets_reference_index").on(
      table.referenceAssetId,
    ),
    index("generation_reference_assets_character_index").on(table.characterId),
    check(
      "generation_reference_assets_position_positive",
      sql`${table.position} >= 0`,
    ),
    check(
      "generation_reference_assets_live_snapshot_match",
      sql`${table.referenceAssetId} is null or ${table.referenceAssetId} = ${table.referenceAssetIdSnapshot}`,
    ),
    foreignKey({
      columns: [table.generationId, table.workspaceId],
      foreignColumns: [
        sceneImageGenerations.id,
        sceneImageGenerations.workspaceId,
      ],
      name: "generation_reference_assets_tenant_generation_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.characterId, table.workspaceId],
      foreignColumns: [characters.id, characters.workspaceId],
      name: "generation_reference_assets_tenant_character_fkey",
    }).onDelete("restrict"),
  ],
);

export const providerRequests = pgTable(
  "provider_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    generationId: uuid("generation_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: providerRequestStatusEnum("status").notNull().default("pending"),
    providerRequestId: text("provider_request_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    textInputUnits: integer("text_input_units"),
    imageInputUnits: integer("image_input_units"),
    outputUnits: integer("output_units"),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    errorCode: text("error_code"),
    safeErrorMessage: text("safe_error_message"),
    safeMetadata: jsonb("safe_metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("provider_requests_generation_attempt_unique").on(
      table.generationId,
      table.attemptNumber,
    ),
    uniqueIndex("provider_requests_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("provider_requests_workspace_status_index").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    check(
      "provider_requests_units_nonnegative",
      sql`(${table.textInputUnits} is null or ${table.textInputUnits} >= 0) and (${table.imageInputUnits} is null or ${table.imageInputUnits} >= 0) and (${table.outputUnits} is null or ${table.outputUnits} >= 0)`,
    ),
    check(
      "provider_requests_attempt_positive",
      sql`${table.attemptNumber} > 0`,
    ),
    check(
      "provider_requests_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    foreignKey({
      columns: [table.generationId, table.projectId, table.workspaceId],
      foreignColumns: [
        sceneImageGenerations.id,
        sceneImageGenerations.projectId,
        sceneImageGenerations.workspaceId,
      ],
      name: "provider_requests_tenant_generation_fkey",
    }).onDelete("cascade"),
  ],
);

export const customVoices = pgTable(
  "custom_voices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("openai"),
    providerVoiceId: text("provider_voice_id").notNull(),
    providerConsentId: text("provider_consent_id").notNull(),
    consentLanguage: text("consent_language").notNull(),
    status: customVoiceStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("custom_voices_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("custom_voices_provider_voice_unique").on(
      table.provider,
      table.providerVoiceId,
    ),
    index("custom_voices_workspace_status_index").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const voicePresets = pgTable(
  "voice_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    provider: text("provider").notNull().default("openai"),
    model: text("model").notNull(),
    voice: text("voice").notNull(),
    customVoiceId: uuid("custom_voice_id"),
    instructions: text("instructions").notNull().default(""),
    speedScaledPercent: integer("speed_scaled_percent").notNull().default(100),
    format: audioOutputFormatEnum("format").notNull().default("mp3"),
    sampleRate: integer("sample_rate"),
    isDefault: boolean("is_default").notNull().default(false),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("voice_presets_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("voice_presets_workspace_slug_unique").on(
      table.workspaceId,
      table.slug,
    ),
    uniqueIndex("voice_presets_workspace_default_unique")
      .on(table.workspaceId)
      .where(sql`${table.isDefault} = true and ${table.archivedAt} is null`),
    index("voice_presets_workspace_index").on(table.workspaceId, table.name),
    check(
      "voice_presets_speed_range",
      sql`${table.speedScaledPercent} between 25 and 400`,
    ),
    foreignKey({
      columns: [table.customVoiceId, table.workspaceId],
      foreignColumns: [customVoices.id, customVoices.workspaceId],
      name: "voice_presets_tenant_custom_voice_fkey",
    }).onDelete("restrict"),
  ],
);

export const sceneAudioGenerations = pgTable(
  "scene_audio_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    sceneId: uuid("scene_id").notNull(),
    sceneVersionId: uuid("scene_version_id").notNull(),
    voicePresetId: uuid("voice_preset_id"),
    source: audioGenerationSourceEnum("source")
      .notNull()
      .default("ai_generated"),
    generationVersion: integer("generation_version").notNull(),
    requestNonce: uuid("request_nonce").notNull(),
    status: audioGenerationStatusEnum("status").notNull().default("pending"),
    reviewStatus: audioReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key"),
    requestFingerprint: text("request_fingerprint"),
    provider: text("provider"),
    model: text("model"),
    voice: text("voice"),
    isCustomVoice: boolean("is_custom_voice").notNull().default(false),
    format: sceneAudioAssetFormatEnum("format").notNull(),
    speedScaledPercent: integer("speed_scaled_percent"),
    instructions: text("instructions").notNull().default(""),
    sampleRate: integer("sample_rate"),
    inputText: text("input_text").notNull(),
    inputCharacterCount: integer("input_character_count").notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    assetObjectKey: text("asset_object_key"),
    assetContentType: text("asset_content_type"),
    assetSizeBytes: integer("asset_size_bytes"),
    assetEtag: text("asset_etag"),
    durationMilliseconds: integer("duration_milliseconds"),
    // Fixed-rate loudness envelope (integer percentages at
    // AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ) measured once when the audio is
    // produced, so animated lip-sync works in the browser preview — which
    // cannot run ffmpeg — and the render worker never recomputes it. Null when
    // ffmpeg was unavailable or the audio could not be decoded; the character
    // then idles instead of the render failing.
    amplitudeEnvelope: jsonb("amplitude_envelope").$type<number[]>(),
    inspectionStatus: mediaInspectionStatusEnum("inspection_status"),
    verifiedMetadata: jsonb("verified_metadata").$type<VerifiedMediaMetadata>(),
    inspectionWarnings: jsonb("inspection_warnings")
      .$type<string[]>()
      .notNull()
      .default([]),
    inspectionTriggerRunId: text("inspection_trigger_run_id"),
    inspectionError: text("inspection_error"),
    inspectedAt: timestamp("inspected_at", { withTimezone: true }),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("scene_audio_generations_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("scene_audio_generations_id_project_workspace_unique").on(
      table.id,
      table.projectId,
      table.workspaceId,
    ),
    uniqueIndex("scene_audio_generations_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("scene_audio_generations_version_unique").on(
      table.sceneVersionId,
      table.generationVersion,
    ),
    uniqueIndex("scene_audio_generations_workspace_request_nonce_unique").on(
      table.workspaceId,
      table.requestNonce,
    ),
    uniqueIndex("scene_audio_generations_approved_scene_version_unique")
      .on(table.sceneVersionId)
      .where(sql`${table.reviewStatus} = 'approved'`),
    index("scene_audio_generations_workspace_project_scene_index").on(
      table.workspaceId,
      table.projectId,
      table.sceneId,
      table.createdAt,
    ),
    index("scene_audio_generations_status_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    check(
      "scene_audio_generations_version_positive",
      sql`${table.generationVersion} > 0`,
    ),
    check(
      "scene_audio_generations_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "scene_audio_generations_progress_range",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "scene_audio_generations_speed_range",
      sql`${table.speedScaledPercent} is null or ${table.speedScaledPercent} between 25 and 400`,
    ),
    check(
      "scene_audio_generations_duration_nonnegative",
      sql`${table.durationMilliseconds} is null or ${table.durationMilliseconds} >= 0`,
    ),
    check(
      "scene_audio_generations_input_characters_positive",
      sql`${table.inputCharacterCount} > 0`,
    ),
    check(
      "scene_audio_generations_approved_succeeded",
      sql`${table.reviewStatus} <> 'approved' or ${table.status} = 'succeeded'`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "scene_audio_generations_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.sceneId, table.projectId, table.workspaceId],
      foreignColumns: [scenes.id, scenes.projectId, scenes.workspaceId],
      name: "scene_audio_generations_tenant_scene_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [
        table.sceneVersionId,
        table.sceneId,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [
        sceneVersions.id,
        sceneVersions.sceneId,
        sceneVersions.projectId,
        sceneVersions.workspaceId,
      ],
      name: "scene_audio_generations_tenant_version_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.voicePresetId, table.workspaceId],
      foreignColumns: [voicePresets.id, voicePresets.workspaceId],
      name: "scene_audio_generations_tenant_voice_fkey",
    }).onDelete("restrict"),
  ],
);

export const videoRenders = pgTable(
  "video_renders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    outputVariantId: uuid("output_variant_id"),
    shortCompositionId: uuid("short_composition_id"),
    requestNonce: uuid("request_nonce").notNull(),
    status: renderStatusEnum("status").notNull().default("pending"),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    preset: text("preset").notNull(),
    aspectRatio: projectAspectRatioEnum("aspect_ratio").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    framesPerSecond: integer("frames_per_second").notNull(),
    includeCaptions: boolean("include_captions").notNull().default(true),
    includeWatermark: boolean("include_watermark").notNull().default(false),
    sceneCount: integer("scene_count").notNull(),
    captionCount: integer("caption_count").notNull().default(0),
    durationMilliseconds: integer("duration_milliseconds").notNull(),
    totalFrames: integer("total_frames").notNull(),
    timelineSnapshot: jsonb("timeline_snapshot")
      .$type<RenderTimelineSnapshot>()
      .notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    assetObjectKey: text("asset_object_key"),
    assetContentType: text("asset_content_type"),
    assetSizeBytes: integer("asset_size_bytes"),
    assetEtag: text("asset_etag"),
    outputDurationMilliseconds: integer("output_duration_milliseconds"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_renders_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("video_renders_id_project_workspace_unique").on(
      table.id,
      table.projectId,
      table.workspaceId,
    ),
    uniqueIndex("video_renders_idempotency_unique").on(table.idempotencyKey),
    uniqueIndex("video_renders_workspace_request_nonce_unique").on(
      table.workspaceId,
      table.requestNonce,
    ),
    index("video_renders_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    index("video_renders_status_index").on(
      table.workspaceId,
      table.status,
      table.updatedAt,
    ),
    check("video_renders_width_positive", sql`${table.width} > 0`),
    check("video_renders_height_positive", sql`${table.height} > 0`),
    check(
      "video_renders_fps_valid",
      sql`${table.framesPerSecond} between 1 and 120`,
    ),
    check("video_renders_scene_count_positive", sql`${table.sceneCount} > 0`),
    check(
      "video_renders_caption_count_nonnegative",
      sql`${table.captionCount} >= 0`,
    ),
    check(
      "video_renders_duration_positive",
      sql`${table.durationMilliseconds} > 0 and ${table.totalFrames} > 0`,
    ),
    check(
      "video_renders_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "video_renders_progress_range",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check(
      "video_renders_output_duration_nonnegative",
      sql`${table.outputDurationMilliseconds} is null or ${table.outputDurationMilliseconds} >= 0`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "video_renders_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.outputVariantId, table.workspaceId],
      foreignColumns: [
        projectOutputVariants.id,
        projectOutputVariants.workspaceId,
      ],
      name: "video_renders_tenant_output_variant_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.shortCompositionId, table.workspaceId],
      foreignColumns: [shortCompositions.id, shortCompositions.workspaceId],
      name: "video_renders_tenant_short_composition_fkey",
    }).onDelete("restrict"),
  ],
);

/**
 * One attempt to publish a finished render to a connected platform account.
 * Uploads cost no money (platforms meter by API quota, not billing), so this
 * deliberately does NOT participate in the `usage_reservations` ledger — adding
 * a zero-cost reservation would pollute spend reporting.
 */
export const videoPublications = pgTable(
  "video_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    renderId: uuid("render_id").notNull(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => platformConnections.id, { onDelete: "restrict" }),
    platform: contentPlatformEnum("platform").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    visibility: publicationVisibilityEnum("visibility")
      .notNull()
      .default("private"),
    /** Instagram's exact caption. Null for platforms with separate metadata. */
    caption: text("caption"),
    /** Whether an Instagram Reel also appears in the account's main feed. */
    shareToFeed: boolean("share_to_feed"),
    status: videoPublicationStatusEnum("status").notNull().default("pending"),
    progressPercent: integer("progress_percent").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    /** Platform's id for the created video, once it exists. */
    externalVideoId: text("external_video_id"),
    externalVideoUrl: text("external_video_url"),
    /** Resumable/asynchronous provider operation id, e.g. IG media container. */
    providerOperationId: text("provider_operation_id"),
    /** Encrypted ephemeral provider credential, e.g. a TikTok upload URL. */
    providerOperationSecretSealed: text("provider_operation_secret_sealed"),
    providerOperationStage: text("provider_operation_stage"),
    /** Required evidence of explicit consent for TikTok inbox delivery. */
    consentConfirmedAt: timestamp("consent_confirmed_at", {
      withTimezone: true,
    }),
    uploadedBytes: integer("uploaded_bytes"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("video_publications_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("video_publications_idempotency_unique").on(
      table.idempotencyKey,
    ),
    index("video_publications_workspace_project_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    index("video_publications_render_index").on(table.renderId),
    check(
      "video_publications_progress_valid",
      sql`${table.progressPercent} between 0 and 100`,
    ),
    check("video_publications_title_present", sql`length(${table.title}) > 0`),
    check(
      "video_publications_instagram_metadata_valid",
      sql`(
        ${table.platform} = 'instagram'
        and ${table.caption} is not null
        and ${table.shareToFeed} is not null
        and ${table.visibility} = 'public'
      ) or (
        ${table.platform} <> 'instagram'
        and ${table.caption} is null
        and ${table.shareToFeed} is null
      )`,
    ),
    check(
      "video_publications_tiktok_metadata_valid",
      sql`(
        ${table.platform} = 'tiktok'
        and ${table.visibility} = 'platform_default'
        and ${table.consentConfirmedAt} is not null
      ) or (
        ${table.platform} <> 'tiktok'
        and ${table.visibility} <> 'platform_default'
        and ${table.consentConfirmedAt} is null
      )`,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "video_publications_tenant_project_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.renderId, table.projectId, table.workspaceId],
      foreignColumns: [
        videoRenders.id,
        videoRenders.projectId,
        videoRenders.workspaceId,
      ],
      name: "video_publications_tenant_render_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * A social post: one piece of writing, optionally with library media, sent to
 * one or more connected accounts.
 *
 * Workspace-scoped, not project-scoped. `projectId` is nullable and exists only
 * as a link back to a rendered video when a post happens to be about one — a
 * post needs no project, and most will not have one.
 */
export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Internal label for the posts list; never sent to a platform. */
    name: text("name").notNull().default(""),
    /** The structured editor document. Validated by `portableDocumentSchema`. */
    bodyDocument: jsonb("body_document")
      .$type<PortableDocument>()
      .notNull()
      .default({ type: "doc", content: [] }),
    /**
     * The document flattened by `renderPortableDocumentToPlainText`. Stored
     * rather than derived on read because it is what actually gets published,
     * and a later change to the renderer must not silently rewrite the text an
     * already-published post was sent with.
     */
    bodyPlainText: text("body_plain_text").notNull().default(""),
    status: socialPostStatusEnum("status").notNull().default("draft"),
    /** Absolute instant the scheduler may claim this post. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    /** The author's zone, kept only so the UI can redisplay their intent. */
    scheduledTimezone: text("scheduled_timezone").notNull().default("UTC"),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    /** Optimistic lock: a stale composer tab cannot overwrite a newer edit. */
    version: integer("version").notNull().default(1),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("social_posts_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("social_posts_workspace_status_index").on(
      table.workspaceId,
      table.status,
      table.scheduledAt,
    ),
    index("social_posts_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    // The scheduler sweeper's claim query: due, scheduled, oldest first. Not
    // workspace-scoped, because the sweep is global by design.
    index("social_posts_due_index").on(table.status, table.scheduledAt),
    check(
      "social_posts_scheduled_requires_time",
      sql`${table.status} <> 'scheduled' or ${table.scheduledAt} is not null`,
    ),
  ],
);

/** Ordered library media attached to a post. */
export const socialPostMedia = pgTable(
  "social_post_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Restricted rather than cascading: a published post must keep showing the
    // media it sent, which is also why `media_assets` is soft deleted.
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id, {
      onDelete: "restrict",
    }),
    /**
     * A finished project render, attached instead of a library asset.
     *
     * Modelled as a second reference rather than by copying the render into the
     * library: renders are large, and duplicating one per post would double the
     * storage bill for no gain. The XOR check below is what keeps "an attachment
     * has exactly one source" true in the database rather than only in code.
     */
    renderId: uuid("render_id").references(() => videoRenders.id, {
      onDelete: "restrict",
    }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("social_post_media_post_position_unique").on(
      table.postId,
      table.position,
    ),
    uniqueIndex("social_post_media_post_asset_unique").on(
      table.postId,
      table.mediaAssetId,
    ),
    uniqueIndex("social_post_media_post_render_unique").on(
      table.postId,
      table.renderId,
    ),
    // Answers "is this asset still in use?" when someone removes it.
    index("social_post_media_asset_index").on(table.mediaAssetId),
    index("social_post_media_render_index").on(table.renderId),
    check(
      "social_post_media_single_source",
      sql`(${table.mediaAssetId} is not null) <> (${table.renderId} is not null)`,
    ),
  ],
);

/**
 * One destination for a post: the account it goes to and how that attempt went.
 *
 * Per-target rather than per-post state is what lets a post report
 * `partially_failed` honestly — see `social_post_status`.
 */
export const socialPostTargets = pgTable(
  "social_post_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => socialPosts.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: contentPlatformEnum("platform").notNull(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => platformConnections.id, { onDelete: "restrict" }),
    status: socialPostTargetStatusEnum("status").notNull().default("pending"),
    /** Set when this platform's copy was edited away from the shared body. */
    overrideBodyPlainText: text("override_body_plain_text"),
    externalPostId: text("external_post_id"),
    externalPostUrl: text("external_post_url"),
    /** Resumable provider operation, e.g. an Instagram media container. */
    providerOperationId: text("provider_operation_id"),
    /** Encrypted ephemeral provider credential, e.g. a TikTok upload URL. */
    providerOperationSecretSealed: text("provider_operation_secret_sealed"),
    attemptCount: integer("attempt_count").notNull().default(0),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("social_post_targets_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("social_post_targets_idempotency_unique").on(
      table.idempotencyKey,
    ),
    // One attempt per account per post: re-adding the same account cannot
    // double-post it.
    uniqueIndex("social_post_targets_post_connection_unique").on(
      table.postId,
      table.connectionId,
    ),
    index("social_post_targets_post_index").on(table.postId, table.status),
    index("social_post_targets_workspace_status_index").on(
      table.workspaceId,
      table.status,
    ),
  ],
);

/**
 * Token-free analytics identity and cursor for one published destination.
 * Connection ids are intentionally not foreign keys: disconnecting or deleting
 * credentials must not erase non-secret historical performance observations.
 */
export const publicationPerformanceSources = pgTable(
  "publication_performance_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    publicationKind: text("publication_kind").notNull(),
    socialPostTargetId: uuid("social_post_target_id"),
    videoPublicationId: uuid("video_publication_id"),
    connectionId: uuid("connection_id"),
    platform: contentPlatformEnum("platform").notNull(),
    providerPublicationId: text("provider_publication_id").notNull(),
    providerDefinitionVersion: text("provider_definition_version").notNull(),
    cursor: text("cursor"),
    syncStatus: performanceSyncStatusEnum("sync_status")
      .notNull()
      .default("pending"),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
    backoffUntil: timestamp("backoff_until", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    safeErrorMessage: text("safe_error_message"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    attribution: jsonb("attribution")
      .$type<{
        titleOrCaption: string;
        thumbnailAssetId: string | null;
        hook: string | null;
        format: string;
        promptVersion: string | null;
        contextVersion: number | null;
        publishedAt: string;
      }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("publication_performance_sources_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("publication_performance_sources_social_unique")
      .on(table.socialPostTargetId)
      .where(sql`${table.socialPostTargetId} is not null`),
    uniqueIndex("publication_performance_sources_video_unique")
      .on(table.videoPublicationId)
      .where(sql`${table.videoPublicationId} is not null`),
    index("publication_performance_sources_due_index").on(
      table.syncStatus,
      table.nextSyncAt,
    ),
    index("publication_performance_sources_workspace_index").on(
      table.workspaceId,
      table.platform,
    ),
    check(
      "publication_performance_sources_kind_target_valid",
      sql`(${table.publicationKind} = 'social_post_target' and ${table.socialPostTargetId} is not null and ${table.videoPublicationId} is null) or (${table.publicationKind} = 'video_publication' and ${table.videoPublicationId} is not null and ${table.socialPostTargetId} is null)`,
    ),
    check(
      "publication_performance_sources_attempt_nonnegative",
      sql`${table.attemptCount} >= 0`,
    ),
    foreignKey({
      columns: [table.socialPostTargetId, table.workspaceId],
      foreignColumns: [socialPostTargets.id, socialPostTargets.workspaceId],
      name: "publication_performance_sources_tenant_social_target_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.videoPublicationId, table.workspaceId],
      foreignColumns: [videoPublications.id, videoPublications.workspaceId],
      name: "publication_performance_sources_tenant_video_publication_fkey",
    }).onDelete("cascade"),
  ],
);

/** Append-only provider observations; definitions are versioned per row. */
export const publicationMetricObservations = pgTable(
  "publication_metric_observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    metricKind: performanceMetricKindEnum("metric_kind").notNull(),
    unit: performanceMetricUnitEnum("unit").notNull(),
    normalizedValue: numeric("normalized_value", {
      precision: 24,
      scale: 6,
    }).notNull(),
    rawMetricKey: text("raw_metric_key").notNull(),
    rawValue: text("raw_value").notNull(),
    providerDefinition: text("provider_definition").notNull(),
    providerDefinitionVersion: text("provider_definition_version").notNull(),
    comparableGroup: text("comparable_group"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("publication_metric_observations_identity_unique").on(
      table.sourceId,
      table.rawMetricKey,
      table.providerDefinitionVersion,
      table.observedAt,
    ),
    index("publication_metric_observations_workspace_kind_index").on(
      table.workspaceId,
      table.metricKind,
      table.observedAt,
    ),
    check(
      "publication_metric_observations_value_nonnegative",
      sql`${table.normalizedValue} >= 0`,
    ),
    foreignKey({
      columns: [table.sourceId, table.workspaceId],
      foreignColumns: [
        publicationPerformanceSources.id,
        publicationPerformanceSources.workspaceId,
      ],
      name: "publication_metric_observations_tenant_source_fkey",
    }).onDelete("cascade"),
  ],
);

export const usageReservations = pgTable(
  "usage_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    operationType: usageOperationTypeEnum("operation_type")
      .notNull()
      .default("scene_analysis"),
    analysisRunId: uuid("analysis_run_id").references(
      () => sceneAnalysisRuns.id,
      { onDelete: "cascade" },
    ),
    imageGenerationId: uuid("image_generation_id"),
    audioGenerationId: uuid("audio_generation_id"),
    videoRenderId: uuid("video_render_id"),
    scriptGenerationId: uuid("script_generation_id").references(
      () => scriptGenerationRuns.id,
      { onDelete: "cascade" },
    ),
    titleGenerationId: uuid("title_generation_id").references(
      () => titleGenerationRuns.id,
      { onDelete: "cascade" },
    ),
    thumbnailGenerationId: uuid("thumbnail_generation_id").references(
      () => thumbnailGenerations.id,
      { onDelete: "cascade" },
    ),
    status: usageReservationStatusEnum("status").notNull().default("pending"),
    reservedCostCents: integer("reserved_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_reservations_id_operation_project_workspace_unique").on(
      table.id,
      table.operationType,
      table.projectId,
      table.workspaceId,
    ),
    uniqueIndex("usage_reservations_analysis_unique")
      .on(table.analysisRunId)
      .where(sql`${table.analysisRunId} is not null`),
    uniqueIndex("usage_reservations_image_generation_unique")
      .on(table.imageGenerationId)
      .where(sql`${table.imageGenerationId} is not null`),
    uniqueIndex("usage_reservations_audio_generation_unique")
      .on(table.audioGenerationId)
      .where(sql`${table.audioGenerationId} is not null`),
    uniqueIndex("usage_reservations_video_render_unique")
      .on(table.videoRenderId)
      .where(sql`${table.videoRenderId} is not null`),
    uniqueIndex("usage_reservations_script_generation_unique")
      .on(table.scriptGenerationId)
      .where(sql`${table.scriptGenerationId} is not null`),
    uniqueIndex("usage_reservations_title_generation_unique")
      .on(table.titleGenerationId)
      .where(sql`${table.titleGenerationId} is not null`),
    uniqueIndex("usage_reservations_thumbnail_generation_unique")
      .on(table.thumbnailGenerationId)
      .where(sql`${table.thumbnailGenerationId} is not null`),
    index("usage_reservations_workspace_project_status_index").on(
      table.workspaceId,
      table.projectId,
      table.status,
    ),
    index("usage_reservations_status_expires_index").on(
      table.status,
      table.expiresAt,
    ),
    check(
      "usage_reservations_cost_nonnegative",
      sql`${table.reservedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "usage_reservations_single_operation",
      sql`(${table.operationType}::text = 'scene_analysis' and ${table.analysisRunId} is not null and ${table.imageGenerationId} is null and ${table.audioGenerationId} is null and ${table.videoRenderId} is null and ${table.scriptGenerationId} is null and ${table.titleGenerationId} is null and ${table.thumbnailGenerationId} is null) or (${table.operationType}::text = 'scene_image_generation' and ${table.analysisRunId} is null and ${table.imageGenerationId} is not null and ${table.audioGenerationId} is null and ${table.videoRenderId} is null and ${table.scriptGenerationId} is null and ${table.titleGenerationId} is null and ${table.thumbnailGenerationId} is null) or (${table.operationType}::text = 'scene_audio_generation' and ${table.analysisRunId} is null and ${table.imageGenerationId} is null and ${table.audioGenerationId} is not null and ${table.videoRenderId} is null and ${table.scriptGenerationId} is null and ${table.titleGenerationId} is null and ${table.thumbnailGenerationId} is null) or (${table.operationType}::text = 'video_render' and ${table.analysisRunId} is null and ${table.imageGenerationId} is null and ${table.audioGenerationId} is null and ${table.videoRenderId} is not null and ${table.scriptGenerationId} is null and ${table.titleGenerationId} is null and ${table.thumbnailGenerationId} is null) or (${table.operationType}::text = 'script_generation' and ${table.analysisRunId} is null and ${table.imageGenerationId} is null and ${table.audioGenerationId} is null and ${table.videoRenderId} is null and ${table.scriptGenerationId} is not null and ${table.titleGenerationId} is null and ${table.thumbnailGenerationId} is null) or (${table.operationType}::text = 'title_generation' and ${table.analysisRunId} is null and ${table.imageGenerationId} is null and ${table.audioGenerationId} is null and ${table.videoRenderId} is null and ${table.scriptGenerationId} is null and ${table.titleGenerationId} is not null and ${table.thumbnailGenerationId} is null) or (${table.operationType}::text = 'thumbnail_generation' and ${table.analysisRunId} is null and ${table.imageGenerationId} is null and ${table.audioGenerationId} is null and ${table.videoRenderId} is null and ${table.scriptGenerationId} is null and ${table.titleGenerationId} is null and ${table.thumbnailGenerationId} is not null)`,
    ),
    foreignKey({
      columns: [table.imageGenerationId, table.projectId, table.workspaceId],
      foreignColumns: [
        sceneImageGenerations.id,
        sceneImageGenerations.projectId,
        sceneImageGenerations.workspaceId,
      ],
      name: "usage_reservations_tenant_generation_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.audioGenerationId, table.projectId, table.workspaceId],
      foreignColumns: [
        sceneAudioGenerations.id,
        sceneAudioGenerations.projectId,
        sceneAudioGenerations.workspaceId,
      ],
      name: "usage_reservations_tenant_audio_generation_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.videoRenderId, table.projectId, table.workspaceId],
      foreignColumns: [
        videoRenders.id,
        videoRenders.projectId,
        videoRenders.workspaceId,
      ],
      name: "usage_reservations_tenant_video_render_fkey",
    }).onDelete("cascade"),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    operationType: usageOperationTypeEnum("operation_type").notNull(),
    eventType: usageEventTypeEnum("event_type").notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    safeMetadata: jsonb("safe_metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_events_reservation_event_unique").on(
      table.reservationId,
      table.eventType,
    ),
    index("usage_events_workspace_project_created_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
    index("usage_events_reservation_index").on(table.reservationId),
    check(
      "usage_events_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    foreignKey({
      columns: [
        table.reservationId,
        table.operationType,
        table.projectId,
        table.workspaceId,
      ],
      foreignColumns: [
        usageReservations.id,
        usageReservations.operationType,
        usageReservations.projectId,
        usageReservations.workspaceId,
      ],
      name: "usage_events_tenant_reservation_fkey",
    }).onDelete("cascade"),
  ],
);

export const workspaceBudgetSettings = pgTable(
  "workspace_budget_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    dailyBudgetCents: integer("daily_budget_cents").notNull(),
    monthlyBudgetCents: integer("monthly_budget_cents").notNull(),
    manualConfirmationThresholdCents: integer(
      "manual_confirmation_threshold_cents",
    ).notNull(),
    maxImagesPerBatch: integer("max_images_per_batch"),
    maxScenesPerAudioBatch: integer("max_scenes_per_audio_batch"),
    maxRenderDurationSeconds: integer("max_render_duration_seconds"),
    maxRetryAttempts: integer("max_retry_attempts"),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("workspace_budget_settings_workspace_unique").on(
      table.workspaceId,
    ),
    check(
      "workspace_budget_settings_budgets_nonnegative",
      sql`${table.dailyBudgetCents} >= 0 and ${table.monthlyBudgetCents} >= 0 and ${table.manualConfirmationThresholdCents} >= 0`,
    ),
    check(
      "workspace_budget_settings_overrides_valid",
      sql`(${table.maxImagesPerBatch} is null or ${table.maxImagesPerBatch} > 0) and (${table.maxScenesPerAudioBatch} is null or ${table.maxScenesPerAudioBatch} > 0) and (${table.maxRenderDurationSeconds} is null or ${table.maxRenderDurationSeconds} > 0) and (${table.maxRetryAttempts} is null or ${table.maxRetryAttempts} >= 0)`,
    ),
  ],
);

/**
 * How much the Marketing Studio is allowed to do without a human.
 *
 * `manual` generates only on request and publishes nothing by itself.
 * `assisted` lets schedule rules generate and lets approved items publish
 * themselves. `autonomous` additionally approves within caps. A schedule rule
 * may sit below the workspace level but never above it, and setting this back
 * to `manual` is the kill switch. See `docs/marketing/09-automation.md`.
 */
export const marketingAutonomyLevelEnum = pgEnum("marketing_autonomy_level", [
  "manual",
  "assisted",
  "autonomous",
]);

export const marketingSettings = pgTable(
  "marketing_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /**
     * The workspace's own on/off switch, flipped from workspace settings.
     *
     * Distinct from `ENABLE_MARKETING_STUDIO`, which is a deployment flag no
     * running app can change and which the worker must agree with. This is the
     * per-workspace layer beneath it: the deployment says the feature may exist,
     * this says a given workspace has opted into it. Defaults to **off** so a
     * deploy that switches the feature on does not silently hand every existing
     * workspace something that can spend money.
     */
    studioEnabled: boolean("studio_enabled").notNull().default(false),
    autonomyLevel: marketingAutonomyLevelEnum("autonomy_level")
      .notNull()
      .default("manual"),
    requireApprovalBeforePublish: boolean("require_approval_before_publish")
      .notNull()
      .default(true),
    defaultTimezone: text("default_timezone").notNull().default("UTC"),
    defaultLanguage: text("default_language").notNull().default("English"),
    brandedDefault: boolean("branded_default").notNull().default(true),
    /** A ceiling inside the workspace budget, not a second budget. */
    monthlyMarketingBudgetCents: integer("monthly_marketing_budget_cents"),
    dailyMaxGeneratedItems: integer("daily_max_generated_items")
      .notNull()
      .default(10),
    researchRefreshDays: integer("research_refresh_days").notNull().default(7),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_settings_workspace_unique").on(table.workspaceId),
    check(
      "marketing_settings_daily_items_positive",
      sql`${table.dailyMaxGeneratedItems} > 0`,
    ),
    check(
      "marketing_settings_research_refresh_positive",
      sql`${table.researchRefreshDays} > 0`,
    ),
    check(
      "marketing_settings_budget_nonnegative",
      sql`${table.monthlyMarketingBudgetCents} is null or ${table.monthlyMarketingBudgetCents} >= 0`,
    ),
  ],
);

export const marketingOnboardingStatusEnum = pgEnum(
  "marketing_onboarding_status",
  ["not_started", "in_progress", "complete"],
);

/**
 * The synthesised description of a business, one row per workspace.
 *
 * `contextVersion` is load-bearing rather than decorative: it is bumped by any
 * change that would alter the compiled brand context, and every generation
 * records which version it used. That is what keeps a past generation
 * explainable after the profile has moved on.
 */
export const marketingBrandProfiles = pgTable(
  "marketing_brand_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull().default(""),
    websiteUrl: text("website_url"),
    oneLiner: text("one_liner").notNull().default(""),
    longDescription: text("long_description").notNull().default(""),
    industry: text("industry").notNull().default(""),
    primaryLanguage: text("primary_language").notNull().default("English"),
    timezone: text("timezone").notNull().default("UTC"),
    brandVoiceSummary: text("brand_voice_summary").notNull().default(""),
    toneAttributes: jsonb("tone_attributes")
      .$type<string[]>()
      .notNull()
      .default([]),
    writingRules: jsonb("writing_rules")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Never-use phrases. Reach the prompt as negative constraints. */
    bannedPhrases: jsonb("banned_phrases")
      .$type<string[]>()
      .notNull()
      .default([]),
    valueProps: jsonb("value_props").$type<string[]>().notNull().default([]),
    proofPoints: jsonb("proof_points").$type<string[]>().notNull().default([]),
    complianceNotes: text("compliance_notes").notNull().default(""),
    onboardingStatus: marketingOnboardingStatusEnum("onboarding_status")
      .notNull()
      .default("not_started"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", {
      withTimezone: true,
    }),
    contextVersion: integer("context_version").notNull().default(1),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_brand_profiles_workspace_unique").on(
      table.workspaceId,
    ),
    uniqueIndex("marketing_brand_profiles_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    check(
      "marketing_brand_profiles_context_version_positive",
      sql`${table.contextVersion} > 0`,
    ),
  ],
);

export const marketingBrandAudiences = pgTable(
  "marketing_brand_audiences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandProfileId: uuid("brand_profile_id")
      .notNull()
      .references(() => marketingBrandProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    painPoints: jsonb("pain_points").$type<string[]>().notNull().default([]),
    geography: text("geography").notNull().default(""),
    buyingTriggers: jsonb("buying_triggers")
      .$type<string[]>()
      .notNull()
      .default([]),
    isPrimary: boolean("is_primary").notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("marketing_brand_audiences_profile_index").on(
      table.workspaceId,
      table.brandProfileId,
      table.position,
    ),
    // Exactly one primary audience per profile, enforced by the database rather
    // than by whichever code path happened to write last.
    uniqueIndex("marketing_brand_audiences_primary_unique")
      .on(table.brandProfileId)
      .where(sql`${table.isPrimary}`),
  ],
);

export const marketingBrandOffers = pgTable(
  "marketing_brand_offers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandProfileId: uuid("brand_profile_id")
      .notNull()
      .references(() => marketingBrandProfiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    summary: text("summary").notNull().default(""),
    priceModel: text("price_model").notNull().default(""),
    audienceId: uuid("audience_id").references(
      () => marketingBrandAudiences.id,
      { onDelete: "set null" },
    ),
    differentiators: jsonb("differentiators")
      .$type<string[]>()
      .notNull()
      .default([]),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("marketing_brand_offers_profile_index").on(
      table.workspaceId,
      table.brandProfileId,
      table.position,
    ),
  ],
);

export const marketingBrandChannels = pgTable(
  "marketing_brand_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: contentPlatformEnum("platform").notNull(),
    handle: text("handle").notNull().default(""),
    cadencePerWeek: integer("cadence_per_week").notNull().default(0),
    toneOverride: text("tone_override").notNull().default(""),
    hashtagStrategy: text("hashtag_strategy").notNull().default(""),
    isBrandedDefault: boolean("is_branded_default").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_brand_channels_workspace_platform_unique").on(
      table.workspaceId,
      table.platform,
    ),
    check(
      "marketing_brand_channels_cadence_range",
      sql`${table.cadencePerWeek} >= 0 and ${table.cadencePerWeek} <= 50`,
    ),
  ],
);

export const googleBusinessConnectionStatusEnum = pgEnum(
  "google_business_connection_status",
  ["active", "expired", "revoked"],
);

export const googleBusinessSyncStatusEnum = pgEnum(
  "google_business_sync_status",
  ["never", "syncing", "succeeded", "failed"],
);

export type GoogleBusinessLocationData = {
  title: string;
  storeCode: string;
  categories: string[];
  primaryCategory: string;
  description: string;
  websiteUri: string;
  phoneNumbers: string[];
  addressLines: string[];
  locality: string;
  administrativeArea: string;
  postalCode: string;
  regionCode: string;
  regularHours: string[];
  serviceArea: string;
};

/** One encrypted Google Business Profile authorization per workspace. */
export const googleBusinessConnections = pgTable(
  "google_business_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accessTokenSealed: text("access_token_sealed").notNull(),
    refreshTokenSealed: text("refresh_token_sealed"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    scopes: text("scopes").notNull().default(""),
    status: googleBusinessConnectionStatusEnum("status")
      .notNull()
      .default("active"),
    syncStatus: googleBusinessSyncStatusEnum("sync_status")
      .notNull()
      .default("never"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastSyncAttemptAt: timestamp("last_sync_attempt_at", {
      withTimezone: true,
    }),
    lastError: text("last_error"),
    connectedByUserId: uuid("connected_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("google_business_connections_workspace_unique").on(
      table.workspaceId,
    ),
    uniqueIndex("google_business_connections_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("google_business_connections_sync_index").on(
      table.status,
      table.lastSyncedAt,
    ),
  ],
);

/** Discovered locations; only selected rows contribute to AI grounding. */
export const googleBusinessLocations = pgTable(
  "google_business_locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    accountName: text("account_name").notNull(),
    accountDisplayName: text("account_display_name").notNull().default(""),
    locationName: text("location_name").notNull(),
    title: text("title").notNull().default(""),
    selected: boolean("selected").notNull().default(false),
    isPrimary: boolean("is_primary").notNull().default(false),
    profileData: jsonb("profile_data")
      .$type<GoogleBusinessLocationData>()
      .notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("google_business_locations_workspace_name_unique").on(
      table.workspaceId,
      table.locationName,
    ),
    uniqueIndex("google_business_locations_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("google_business_locations_primary_unique")
      .on(table.workspaceId)
      .where(sql`${table.selected} and ${table.isPrimary}`),
    index("google_business_locations_selected_index").on(
      table.workspaceId,
      table.selected,
      table.title,
    ),
    check(
      "google_business_locations_primary_selected",
      sql`not ${table.isPrimary} or ${table.selected}`,
    ),
    foreignKey({
      columns: [table.connectionId, table.workspaceId],
      foreignColumns: [
        googleBusinessConnections.id,
        googleBusinessConnections.workspaceId,
      ],
      name: "google_business_locations_tenant_connection_fkey",
    }).onDelete("cascade"),
  ],
);

/** Immutable copies of provider data retained for synchronization provenance. */
export const googleBusinessLocationSnapshots = pgTable(
  "google_business_location_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    locationId: uuid("location_id").notNull(),
    checksum: text("checksum").notNull(),
    profileData: jsonb("profile_data")
      .$type<GoogleBusinessLocationData>()
      .notNull(),
    providerRequestId: text("provider_request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("google_business_location_snapshots_checksum_unique").on(
      table.workspaceId,
      table.locationId,
      table.checksum,
    ),
    index("google_business_location_snapshots_recent_index").on(
      table.workspaceId,
      table.locationId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.connectionId, table.workspaceId],
      foreignColumns: [
        googleBusinessConnections.id,
        googleBusinessConnections.workspaceId,
      ],
      name: "google_business_snapshots_tenant_connection_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.locationId, table.workspaceId],
      foreignColumns: [
        googleBusinessLocations.id,
        googleBusinessLocations.workspaceId,
      ],
      name: "google_business_snapshots_tenant_location_fkey",
    }).onDelete("cascade"),
  ],
);

/**
 * The raw onboarding answers, kept deliberately separate from the synthesised
 * profile above.
 *
 * Re-synthesising a profile — after a prompt improvement, or after three more
 * answers arrive — must never destroy what the user actually typed. The
 * question catalogue itself is code (`lib/marketing/brand/onboarding-questions.ts`),
 * so adding a question later cannot invalidate stored answers and removing one
 * does not delete them.
 */
export const marketingOnboardingAnswers = pgTable(
  "marketing_onboarding_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    questionKey: text("question_key").notNull(),
    answerText: text("answer_text").notNull().default(""),
    answeredByUserId: uuid("answered_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_onboarding_answers_workspace_question_unique").on(
      table.workspaceId,
      table.questionKey,
    ),
  ],
);

export const marketingBrandAssetRoleEnum = pgEnum(
  "marketing_brand_asset_role",
  [
    "logo_primary",
    "logo_alt",
    "logo_mark",
    "wordmark",
    "product_shot",
    "team_photo",
    "brand_pattern",
    "font_specimen",
    "screenshot",
    "other",
  ],
);

/**
 * Gives an existing library asset a brand role.
 *
 * A join rather than a copy: the bytes already live in `media_assets`, and
 * duplicating them would mean two places to keep in step and two places to
 * delete from.
 */
export const marketingBrandAssets = pgTable(
  "marketing_brand_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id").notNull(),
    role: marketingBrandAssetRoleEnum("role").notNull(),
    notes: text("notes").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_brand_assets_workspace_asset_unique").on(
      table.workspaceId,
      table.mediaAssetId,
    ),
    // One primary logo per workspace. Every other role may repeat.
    uniqueIndex("marketing_brand_assets_primary_logo_unique")
      .on(table.workspaceId)
      .where(sql`${table.role} = 'logo_primary'`),
    index("marketing_brand_assets_role_index").on(
      table.workspaceId,
      table.role,
      table.position,
    ),
    // Composite tenant FK: makes attaching another workspace's asset impossible
    // in the database, not merely in the query layer. Uses the existing
    // media_assets_id_workspace_unique index.
    foreignKey({
      columns: [table.mediaAssetId, table.workspaceId],
      foreignColumns: [mediaAssets.id, mediaAssets.workspaceId],
      name: "marketing_brand_assets_tenant_media_fkey",
    }).onDelete("restrict"),
  ],
);

export const marketingDocumentSourceEnum = pgEnum("marketing_document_source", [
  "upload",
  "pasted",
  "url_capture",
]);

export const marketingDocumentStatusEnum = pgEnum("marketing_document_status", [
  "pending",
  "extracting",
  "ready",
  "failed",
]);

/**
 * Written material the studio treats as fact about the business.
 *
 * Deliberately **not** a `media_assets` kind. Eight call sites branch on
 * `image | video`, and a document reachable from the post composer's media
 * picker is a bug waiting to happen — documents are never attached to a post.
 * Its own table and its own storage prefix keep the two apart.
 *
 * `checksum` is the sha256 of the extracted text and is what makes
 * summarisation idempotent: unchanged text skips the model call entirely.
 */
export const marketingKnowledgeDocuments = pgTable(
  "marketing_knowledge_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceKind: marketingDocumentSourceEnum("source_kind")
      .notNull()
      .default("upload"),
    sourceUrl: text("source_url"),
    /** Null for pasted text, which has no stored object. */
    objectKey: text("object_key"),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    originalFileName: text("original_file_name").notNull().default(""),
    status: marketingDocumentStatusEnum("status").notNull().default("pending"),
    extractedText: text("extracted_text").notNull().default(""),
    extractedCharacterCount: integer("extracted_character_count")
      .notNull()
      .default(0),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    /** Written by the summariser in a later slice; empty until then. */
    summary: text("summary").notNull().default(""),
    keyFacts: jsonb("key_facts").$type<string[]>().notNull().default([]),
    checksum: text("checksum").notNull().default(""),
    extractionVersion: text("extraction_version")
      .notNull()
      .default("knowledge-extraction-v2"),
    summaryVersion: text("summary_version"),
    summaryProviderRequestId: text("summary_provider_request_id"),
    summaryInputTokens: integer("summary_input_tokens").notNull().default(0),
    summaryOutputTokens: integer("summary_output_tokens").notNull().default(0),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    includeInContext: boolean("include_in_context").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_knowledge_documents_object_key_unique")
      .on(table.objectKey)
      .where(sql`${table.objectKey} is not null`),
    uniqueIndex("marketing_knowledge_documents_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_knowledge_documents_status_index").on(
      table.workspaceId,
      table.status,
    ),
    index("marketing_knowledge_documents_context_index").on(
      table.workspaceId,
      table.includeInContext,
      table.priority,
      table.createdAt,
    ),
    // Full-text search over the extracted text, which is what
    // `search_brand_knowledge` runs. Expressed as an expression index because
    // there is no stored tsvector column: a generated column would double the
    // storage of every document for a query that is already fast at this corpus
    // size, and the expression must match the one in the query exactly — hence
    // `'english'` written literally in both places rather than through a
    // configuration variable, which would make the index unusable.
    index("marketing_knowledge_documents_fts_index").using(
      "gin",
      sql`to_tsvector('english', ${table.extractedText})`,
    ),
    check(
      "marketing_knowledge_documents_size_nonnegative",
      sql`${table.sizeBytes} >= 0`,
    ),
    // A stored document must name its object; pasted text must not.
    check(
      "marketing_knowledge_documents_source_object",
      sql`(${table.sourceKind} = 'pasted') = (${table.objectKey} is null)`,
    ),
  ],
);

export const marketingKnowledgeDocumentChunks = pgTable(
  "marketing_knowledge_document_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    documentId: uuid("document_id").notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    checksum: text("checksum").notNull(),
    tokenEstimate: integer("token_estimate").notNull(),
    sourceLocation: jsonb("source_location")
      .$type<{
        kind: "text" | "page" | "section";
        start: number;
        end: number;
        label: string;
      }>()
      .notNull(),
    summary: text("summary").notNull().default(""),
    keyFacts: jsonb("key_facts").$type<string[]>().notNull().default([]),
    summaryVersion: text("summary_version"),
    providerRequestId: text("provider_request_id"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.documentId, table.workspaceId],
      foreignColumns: [
        marketingKnowledgeDocuments.id,
        marketingKnowledgeDocuments.workspaceId,
      ],
      name: "marketing_knowledge_document_chunks_tenant_document_fkey",
    }).onDelete("cascade"),
    uniqueIndex("marketing_knowledge_document_chunks_position_unique").on(
      table.documentId,
      table.chunkIndex,
    ),
    index("marketing_knowledge_document_chunks_workspace_index").on(
      table.workspaceId,
      table.documentId,
    ),
    index("marketing_knowledge_document_chunks_fts_index").using(
      "gin",
      sql`to_tsvector('english', ${table.text})`,
    ),
    check(
      "marketing_knowledge_document_chunks_values_nonnegative",
      sql`${table.chunkIndex} >= 0 and ${table.tokenEstimate} >= 0 and ${table.inputTokens} >= 0 and ${table.outputTokens} >= 0`,
    ),
  ],
);

/**
 * A frozen copy of the brand context block, addressed by its fingerprint.
 *
 * Immutable by convention: a snapshot is never edited, only superseded. This is
 * what makes a past generation explainable after the brand has moved on — every
 * run and every assistant message stores the snapshot id it was grounded on, so
 * "why did it say that?" is answerable months later against the exact text the
 * model actually saw, not against today's profile.
 *
 * `sourceFingerprint` is unique per workspace, which is the whole mechanism:
 * recompiling after an unrelated touch produces the same fingerprint and
 * therefore no new row, so snapshots accumulate only when the business's
 * description of itself genuinely changed.
 */
export const marketingBrandContextSnapshots = pgTable(
  "marketing_brand_context_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** sha256 over every contributing field; identical inputs reuse the row. */
    sourceFingerprint: text("source_fingerprint").notNull(),
    promptVersion: text("prompt_version").notNull(),
    contextVersion: integer("context_version").notNull().default(1),
    compiledText: text("compiled_text").notNull(),
    tokenEstimate: integer("token_estimate").notNull().default(0),
    includedDocumentIds: jsonb("included_document_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    includedDocumentClaims: jsonb("included_document_claims")
      .$type<
        {
          documentId: string;
          title: string;
          checksum: string;
          claims: string[];
        }[]
      >()
      .notNull()
      .default([]),
    omittedDocumentCount: integer("omitted_document_count")
      .notNull()
      .default(0),
    truncated: boolean("truncated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Per workspace, not global: two workspaces with identical brand text must
    // still own separate snapshots, or one could read the other's context.
    uniqueIndex("marketing_brand_context_snapshots_fingerprint_unique").on(
      table.workspaceId,
      table.sourceFingerprint,
    ),
    uniqueIndex("marketing_brand_context_snapshots_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_brand_context_snapshots_recent_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "marketing_brand_context_snapshots_counts_nonnegative",
      sql`${table.tokenEstimate} >= 0 and ${table.omittedDocumentCount} >= 0`,
    ),
  ],
);

export const marketingOperationEnum = pgEnum("marketing_operation", [
  "chat_turn",
  "content_draft",
  "ad_creative_copy",
  "blog_post",
  "email_draft",
  "newsletter_draft",
  "campaign_plan",
  "media_story",
  "document_summary",
  "competitor_analysis",
  "trend_scan",
  "image_generation",
]);

export const marketingRunStatusEnum = pgEnum("marketing_run_status", [
  "pending",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

export const marketingReservationStatusEnum = pgEnum(
  "marketing_reservation_status",
  ["pending", "reconciled", "released"],
);

export const marketingContentReviewDecisionEnum = pgEnum(
  "marketing_content_review_decision",
  ["approved", "changes_requested", "archived"],
);

/**
 * One row per billable marketing operation.
 *
 * Every marketing spend has a run; nothing may call a provider without one. The
 * `finalPrompt` and `requestFingerprint` pair is what the Trigger preflight
 * re-verifies, so a prompt edited between reservation and execution is caught
 * rather than silently paid for.
 */
export const marketingGenerationRuns = pgTable(
  "marketing_generation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    operation: marketingOperationEnum("operation").notNull(),
    status: marketingRunStatusEnum("status").notNull().default("pending"),
    /** Free-form pointer to whatever the run is about; no FK, by design. */
    subjectKind: text("subject_kind").notNull().default(""),
    subjectId: uuid("subject_id"),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    model: text("model").notNull().default(""),
    promptVersion: text("prompt_version").notNull().default(""),
    skillKey: text("skill_key").notNull().default(""),
    skillVersion: integer("skill_version").notNull().default(1),
    brandContextFingerprint: text("brand_context_fingerprint")
      .notNull()
      .default(""),
    finalPrompt: text("final_prompt").notNull().default(""),
    requestFingerprint: text("request_fingerprint").notNull().default(""),
    idempotencyKey: text("idempotency_key").notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    providerRequestId: text("provider_request_id"),
    triggerRunId: text("trigger_run_id"),
    attemptCount: integer("attempt_count").notNull().default(0),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_generation_runs_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("marketing_generation_runs_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_generation_runs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("marketing_generation_runs_status_index").on(
      table.status,
      table.createdAt,
    ),
    check(
      "marketing_generation_runs_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    check(
      "marketing_generation_runs_skill_version_positive",
      sql`${table.skillVersion} > 0`,
    ),
  ],
);

/**
 * The marketing money ledger.
 *
 * Deliberately **not** `usage_reservations`. That table's `project_id` is NOT
 * NULL and marketing work belongs to no project; more importantly its
 * `single_operation` CHECK is a seven-branch OR that has broken twice under
 * `drizzle-kit push`, each time producing a silent constraint violation that
 * rolled back an entire reservation. This table has one non-null FK to one
 * table, the polymorphism lives in an enum column, and the unique index is a
 * plain total one — there is no multi-column predicate for a schema differ to
 * serialise wrongly.
 *
 * The workspace budget is still **one budget**: `lib/budgets/committed-spend.ts`
 * sums both ledgers. Without that, the video pipeline and the marketing studio
 * each observe the full daily allowance and together spend double it.
 */
export const marketingUsageReservations = pgTable(
  "marketing_usage_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: uuid("run_id").notNull(),
    operation: marketingOperationEnum("operation").notNull(),
    status: marketingReservationStatusEnum("status")
      .notNull()
      .default("pending"),
    reservedCostCents: integer("reserved_cost_cents").notNull(),
    actualCostCents: integer("actual_cost_cents"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_usage_reservations_run_unique").on(table.runId),
    uniqueIndex("marketing_usage_reservations_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    // The committed-spend query's index: workspace + window + status.
    index("marketing_usage_reservations_committed_index").on(
      table.workspaceId,
      table.createdAt,
      table.status,
    ),
    index("marketing_usage_reservations_expiry_index").on(
      table.status,
      table.expiresAt,
    ),
    check(
      "marketing_usage_reservations_cost_nonnegative",
      sql`${table.reservedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
    foreignKey({
      columns: [table.runId, table.workspaceId],
      foreignColumns: [
        marketingGenerationRuns.id,
        marketingGenerationRuns.workspaceId,
      ],
      name: "marketing_usage_reservations_tenant_run_fkey",
    }).onDelete("cascade"),
  ],
);

export const marketingUsageEvents = pgTable(
  "marketing_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reservationId: uuid("reservation_id").notNull(),
    operation: marketingOperationEnum("operation").notNull(),
    eventType: text("event_type").notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
    actualCostCents: integer("actual_cost_cents").notNull().default(0),
    safeMetadata: jsonb("safe_metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One event per kind per reservation makes the ledger append-only in
    // practice: a replayed reconcile cannot double-count.
    uniqueIndex("marketing_usage_events_reservation_type_unique").on(
      table.reservationId,
      table.eventType,
    ),
    foreignKey({
      columns: [table.reservationId, table.workspaceId],
      foreignColumns: [
        marketingUsageReservations.id,
        marketingUsageReservations.workspaceId,
      ],
      name: "marketing_usage_events_tenant_reservation_fkey",
    }).onDelete("cascade"),
  ],
);

export const marketingThreadStatusEnum = pgEnum("marketing_thread_status", [
  "active",
  "archived",
]);

export const marketingChatRoleEnum = pgEnum("marketing_chat_role", [
  "user",
  "assistant",
]);

/**
 * `system` and `tool` are deliberately absent.
 *
 * The system prompt is composed on the server from a versioned template and the
 * compiled brand context, and is never a stored turn — storing one would make
 * it look like something a client could have sent. Tool activity lives in the
 * assistant message's `parts`, where the SDK puts it, rather than in rows of a
 * fourth role that nothing renders.
 */
export const marketingChatMessageStatusEnum = pgEnum(
  "marketing_chat_message_status",
  ["streaming", "complete", "failed"],
);

export const marketingChatThreads = pgTable(
  "marketing_chat_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    status: marketingThreadStatusEnum("status").notNull().default("active"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    /** Running total of reconciled turn costs; what the thread footer shows. */
    totalCostCents: integer("total_cost_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("marketing_chat_threads_recent_index").on(
      table.workspaceId,
      table.status,
      table.lastMessageAt,
    ),
    uniqueIndex("marketing_chat_threads_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    check(
      "marketing_chat_threads_counts_nonnegative",
      sql`${table.messageCount} >= 0 and ${table.totalCostCents} >= 0`,
    ),
  ],
);

/**
 * One conversational turn.
 *
 * `position` rather than ordering by `created_at`: two messages written in the
 * same millisecond have no defined order under a timestamp sort, and a
 * conversation replayed in the wrong order is a different conversation. The
 * unique index makes the sequence a database invariant rather than a hope.
 *
 * Every assistant row records `model_id`, `prompt_version`, and
 * `brand_context_snapshot_id`, which together make "why did it say that?"
 * answerable months later against the exact text the model actually saw.
 */
export const marketingChatMessages = pgTable(
  "marketing_chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull(),
    role: marketingChatRoleEnum("role").notNull(),
    parts: jsonb("parts")
      .$type<MarketingChatMessagePart[]>()
      .notNull()
      .default([]),
    /** Projection of the text parts; what search and previews read. */
    plainText: text("plain_text").notNull().default(""),
    position: integer("position").notNull(),
    /** Set on user messages only; the idempotency key for a retried send. */
    requestNonce: uuid("request_nonce"),
    modelId: text("model_id").notNull().default(""),
    promptVersion: text("prompt_version").notNull().default(""),
    brandContextSnapshotId: uuid("brand_context_snapshot_id").references(
      () => marketingBrandContextSnapshots.id,
      { onDelete: "set null" },
    ),
    runId: uuid("run_id").references(() => marketingGenerationRuns.id, {
      onDelete: "set null",
    }),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: integer("cost_cents").notNull().default(0),
    status: marketingChatMessageStatusEnum("status")
      .notNull()
      .default("complete"),
    finishReason: text("finish_reason").notNull().default(""),
    providerRequestId: text("provider_request_id"),
    safeErrorMessage: text("safe_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_chat_messages_position_unique").on(
      table.threadId,
      table.position,
    ),
    // Partial, because only user messages carry a nonce and NULLs would
    // otherwise be free to repeat without meaning anything.
    uniqueIndex("marketing_chat_messages_nonce_unique")
      .on(table.threadId, table.requestNonce)
      .where(sql`${table.requestNonce} is not null`),
    index("marketing_chat_messages_thread_index").on(
      table.threadId,
      table.position,
    ),
    // Drives the reconciler's "did a stream die?" sweep.
    index("marketing_chat_messages_status_index").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    check(
      "marketing_chat_messages_position_nonnegative",
      sql`${table.position} >= 0`,
    ),
    check(
      "marketing_chat_messages_cost_nonnegative",
      sql`${table.costCents} >= 0`,
    ),
    foreignKey({
      columns: [table.threadId, table.workspaceId],
      foreignColumns: [
        marketingChatThreads.id,
        marketingChatThreads.workspaceId,
      ],
      name: "marketing_chat_messages_tenant_thread_fkey",
    }).onDelete("cascade"),
  ],
);

export const marketingToolCallStatusEnum = pgEnum(
  "marketing_tool_call_status",
  ["pending", "running", "succeeded", "failed", "cancelled"],
);

/** Queryable execution record for every chat skill invocation. */
export const marketingChatToolCalls = pgTable(
  "marketing_chat_tool_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => marketingChatMessages.id, { onDelete: "cascade" }),
    toolCallId: text("tool_call_id").notNull(),
    skillKey: text("skill_key").notNull(),
    input: jsonb("input")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    output: jsonb("output").$type<Record<string, unknown>>(),
    status: marketingToolCallStatusEnum("status").notNull().default("pending"),
    runId: uuid("run_id").references(() => marketingGenerationRuns.id, {
      onDelete: "set null",
    }),
    triggerRunId: text("trigger_run_id"),
    estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
    actualCostCents: integer("actual_cost_cents"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_chat_tool_calls_thread_call_unique").on(
      table.threadId,
      table.toolCallId,
    ),
    index("marketing_chat_tool_calls_status_index").on(
      table.workspaceId,
      table.status,
    ),
    foreignKey({
      columns: [table.threadId, table.workspaceId],
      foreignColumns: [
        marketingChatThreads.id,
        marketingChatThreads.workspaceId,
      ],
      name: "marketing_chat_tool_calls_tenant_thread_fkey",
    }).onDelete("cascade"),
    check(
      "marketing_chat_tool_calls_cost_nonnegative",
      sql`${table.estimatedCostCents} >= 0 and (${table.actualCostCents} is null or ${table.actualCostCents} >= 0)`,
    ),
  ],
);

export const marketingContentStatusEnum = pgEnum("marketing_content_status", [
  "draft",
  "needs_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
  "archived",
  "failed",
]);
export const marketingContentKindEnum = pgEnum("marketing_content_kind", [
  "social_post",
  "ad_creative",
  "blog_post",
  "email",
  "newsletter",
  "media_story",
  "graphic",
]);
export const marketingTrafficTypeEnum = pgEnum("marketing_traffic_type", [
  "organic",
  "paid",
  "both",
]);
export const marketingRevisionSourceEnum = pgEnum("marketing_revision_source", [
  "ai",
  "human",
]);

export const marketingCampaignObjectiveEnum = pgEnum(
  "marketing_campaign_objective",
  ["awareness", "traffic", "leads", "sales", "retention", "hiring"],
);
export const marketingCampaignStatusEnum = pgEnum("marketing_campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
]);
export const marketingCampaignAutomationStatusEnum = pgEnum(
  "marketing_campaign_automation_status",
  [
    "not_started",
    "pending",
    "researching",
    "generating",
    "completed",
    "failed",
  ],
);

export const marketingResearchKindEnum = pgEnum("marketing_research_kind", [
  "company",
  "competitor",
  "trend",
  "keyword",
  "audience",
]);
export const marketingResearchStatusEnum = pgEnum("marketing_research_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
]);

export const marketingCompetitors = pgTable(
  "marketing_competitors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    handles: jsonb("handles")
      .$type<Partial<Record<ContentPlatform, string>>>()
      .notNull()
      .default({}),
    notes: text("notes").notNull().default(""),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    lastResearchedAt: timestamp("last_researched_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_competitors_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("marketing_competitors_active_website_unique")
      .on(table.workspaceId, table.websiteUrl)
      .where(
        sql`${table.websiteUrl} is not null and ${table.deletedAt} is null`,
      ),
    index("marketing_competitors_active_priority_index").on(
      table.workspaceId,
      table.isActive,
      table.priority,
    ),
  ],
);

export const marketingResearchSnapshots = pgTable(
  "marketing_research_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: marketingResearchKindEnum("kind").notNull(),
    competitorId: uuid("competitor_id"),
    topic: text("topic").notNull(),
    queries: jsonb("queries").$type<string[]>().notNull().default([]),
    provider: text("provider").notNull().default(""),
    providerRequestId: text("provider_request_id"),
    status: marketingResearchStatusEnum("status").notNull().default("pending"),
    resultDocument: jsonb("result_document").$type<Record<string, unknown>>(),
    citations: jsonb("citations")
      .$type<Record<string, unknown>[]>()
      .notNull()
      .default([]),
    resultHash: text("result_hash"),
    freshnessWindowDays: integer("freshness_window_days").notNull().default(7),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    runId: uuid("run_id").references(() => marketingGenerationRuns.id, {
      onDelete: "set null",
    }),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_research_snapshots_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_research_snapshots_kind_created_index").on(
      table.workspaceId,
      table.kind,
      table.createdAt,
    ),
    index("marketing_research_snapshots_competitor_created_index").on(
      table.workspaceId,
      table.competitorId,
      table.createdAt,
    ),
    index("marketing_research_snapshots_expiry_index").on(
      table.workspaceId,
      table.expiresAt,
    ),
    foreignKey({
      columns: [table.competitorId, table.workspaceId],
      foreignColumns: [
        marketingCompetitors.id,
        marketingCompetitors.workspaceId,
      ],
      name: "marketing_research_snapshots_tenant_competitor_fkey",
    }).onDelete("cascade"),
    check(
      "marketing_research_snapshots_competitor_kind",
      sql`(${table.kind} = 'competitor') = (${table.competitorId} is not null)`,
    ),
    check(
      "marketing_research_snapshots_freshness_positive",
      sql`${table.freshnessWindowDays} > 0`,
    ),
  ],
);

export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    brandProfileId: uuid("brand_profile_id"),
    name: text("name").notNull(),
    objective: marketingCampaignObjectiveEnum("objective").notNull(),
    trafficType: marketingTrafficTypeEnum("traffic_type").notNull(),
    status: marketingCampaignStatusEnum("status").notNull().default("draft"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    audienceId: uuid("audience_id").references(
      () => marketingBrandAudiences.id,
      { onDelete: "set null" },
    ),
    offerId: uuid("offer_id").references(() => marketingBrandOffers.id, {
      onDelete: "set null",
    }),
    keyMessage: text("key_message").notNull().default(""),
    hypothesis: text("hypothesis").notNull().default(""),
    platforms: jsonb("platforms")
      .$type<ContentPlatform[]>()
      .notNull()
      .default([]),
    briefDocument: jsonb("brief_document")
      .$type<PortableDocument>()
      .notNull()
      .default({ type: "doc", content: [] }),
    briefPlainText: text("brief_plain_text").notNull().default(""),
    isBranded: boolean("is_branded").notNull().default(true),
    automationStatus: marketingCampaignAutomationStatusEnum("automation_status")
      .notNull()
      .default("pending"),
    automationTriggerRunId: text("automation_trigger_run_id"),
    automationError: text("automation_error"),
    automationStartedAt: timestamp("automation_started_at", {
      withTimezone: true,
    }),
    automationCompletedAt: timestamp("automation_completed_at", {
      withTimezone: true,
    }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_campaigns_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_campaigns_workspace_status_start_index").on(
      table.workspaceId,
      table.status,
      table.startDate,
    ),
    foreignKey({
      columns: [table.brandProfileId, table.workspaceId],
      foreignColumns: [
        marketingBrandProfiles.id,
        marketingBrandProfiles.workspaceId,
      ],
      name: "marketing_campaigns_tenant_brand_profile_fkey",
    }).onDelete("restrict"),
    check(
      "marketing_campaigns_date_order",
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

/** Exact connected accounts selected for a campaign. Historical selections are
 * retained when disabled so generated content never silently changes target. */
export const marketingCampaignDestinations = pgTable(
  "marketing_campaign_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").notNull(),
    connectionId: uuid("connection_id").notNull(),
    platform: contentPlatformEnum("platform").notNull(),
    isSelected: boolean("is_selected").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex(
      "marketing_campaign_destinations_campaign_connection_unique",
    ).on(table.campaignId, table.connectionId),
    uniqueIndex("marketing_campaign_destinations_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_campaign_destinations_selected_index").on(
      table.workspaceId,
      table.campaignId,
      table.isSelected,
    ),
    foreignKey({
      columns: [table.campaignId, table.workspaceId],
      foreignColumns: [marketingCampaigns.id, marketingCampaigns.workspaceId],
      name: "marketing_campaign_destinations_tenant_campaign_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.connectionId, table.workspaceId],
      foreignColumns: [platformConnections.id, platformConnections.workspaceId],
      name: "marketing_campaign_destinations_tenant_connection_fkey",
    }).onDelete("restrict"),
  ],
);

export const marketingContentItems = pgTable(
  "marketing_content_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id"),
    campaignDestinationId: uuid("campaign_destination_id"),
    kind: marketingContentKindEnum("kind").notNull(),
    platform: contentPlatformEnum("platform"),
    trafficType: marketingTrafficTypeEnum("traffic_type")
      .notNull()
      .default("organic"),
    isBranded: boolean("is_branded").notNull().default(true),
    title: text("title").notNull().default(""),
    bodyDocument: jsonb("body_document")
      .$type<PortableDocument>()
      .notNull()
      .default({ type: "doc", content: [] }),
    bodyPlainText: text("body_plain_text").notNull().default(""),
    structuredPayload:
      jsonb("structured_payload").$type<Record<string, unknown>>(),
    status: marketingContentStatusEnum("status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    socialPostId: uuid("social_post_id").references(() => socialPosts.id, {
      onDelete: "set null",
    }),
    sourceRunId: uuid("source_run_id").references(
      () => marketingGenerationRuns.id,
      { onDelete: "set null" },
    ),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewNotes: text("review_notes").notNull().default(""),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.campaignId, table.workspaceId],
      foreignColumns: [marketingCampaigns.id, marketingCampaigns.workspaceId],
      name: "marketing_content_items_tenant_campaign_fkey",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.campaignDestinationId, table.workspaceId],
      foreignColumns: [
        marketingCampaignDestinations.id,
        marketingCampaignDestinations.workspaceId,
      ],
      name: "marketing_content_items_tenant_destination_fkey",
    }).onDelete("restrict"),
    uniqueIndex("marketing_content_items_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("marketing_content_items_social_post_unique")
      .on(table.socialPostId)
      .where(sql`${table.socialPostId} is not null`),
    index("marketing_content_items_queue_index").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const marketingContentMedia = pgTable(
  "marketing_content_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id").notNull(),
    mediaAssetId: uuid("media_asset_id").notNull(),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_content_media_position_unique").on(
      table.contentItemId,
      table.position,
    ),
    uniqueIndex("marketing_content_media_asset_unique").on(
      table.contentItemId,
      table.mediaAssetId,
    ),
    foreignKey({
      columns: [table.contentItemId, table.workspaceId],
      foreignColumns: [
        marketingContentItems.id,
        marketingContentItems.workspaceId,
      ],
      name: "marketing_content_media_tenant_item_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.mediaAssetId, table.workspaceId],
      foreignColumns: [mediaAssets.id, mediaAssets.workspaceId],
      name: "marketing_content_media_tenant_asset_fkey",
    }).onDelete("restrict"),
  ],
);

export const marketingContentRevisions = pgTable(
  "marketing_content_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id").notNull(),
    revisionNumber: integer("revision_number").notNull(),
    bodyDocument: jsonb("body_document").$type<PortableDocument>().notNull(),
    bodyPlainText: text("body_plain_text").notNull(),
    structuredPayload:
      jsonb("structured_payload").$type<Record<string, unknown>>(),
    changeSource: marketingRevisionSourceEnum("change_source").notNull(),
    changedByUserId: uuid("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    runId: uuid("run_id").references(() => marketingGenerationRuns.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_content_revisions_number_unique").on(
      table.contentItemId,
      table.revisionNumber,
    ),
    foreignKey({
      columns: [table.contentItemId, table.workspaceId],
      foreignColumns: [
        marketingContentItems.id,
        marketingContentItems.workspaceId,
      ],
      name: "marketing_content_revisions_tenant_item_fkey",
    }).onDelete("cascade"),
    check(
      "marketing_content_revisions_number_positive",
      sql`${table.revisionNumber} > 0`,
    ),
  ],
);

/** Append-only review history used for quality and time-to-review metrics. */
export const marketingContentReviewEvents = pgTable(
  "marketing_content_review_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id").notNull(),
    decision: marketingContentReviewDecisionEnum("decision").notNull(),
    reason: text("reason").notNull().default(""),
    reviewedByUserId: uuid("reviewed_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.contentItemId, table.workspaceId],
      foreignColumns: [
        marketingContentItems.id,
        marketingContentItems.workspaceId,
      ],
      name: "marketing_content_review_events_tenant_item_fkey",
    }).onDelete("cascade"),
    index("marketing_content_review_events_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("marketing_content_review_events_item_created_index").on(
      table.contentItemId,
      table.createdAt,
    ),
  ],
);

export const marketingScheduleFrequencyEnum = pgEnum(
  "marketing_schedule_frequency",
  ["daily", "weekly", "monthly"],
);

export const marketingScheduleRunStatusEnum = pgEnum(
  "marketing_schedule_run_status",
  ["claimed", "running", "succeeded", "failed", "skipped"],
);

export const marketingScheduleRules = pgTable(
  "marketing_schedule_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    campaignId: uuid("campaign_id"),
    skillKey: text("skill_key").notNull(),
    contentKind: marketingContentKindEnum("content_kind").notNull(),
    platforms: jsonb("platforms")
      .$type<ContentPlatform[]>()
      .notNull()
      .default([]),
    trafficType: marketingTrafficTypeEnum("traffic_type")
      .notNull()
      .default("organic"),
    isBranded: boolean("is_branded").notNull().default(true),
    promptBrief: text("prompt_brief").notNull(),
    frequency: marketingScheduleFrequencyEnum("frequency").notNull(),
    byWeekday: jsonb("by_weekday").$type<number[]>().notNull().default([]),
    byMonthDay: integer("by_month_day"),
    timeOfDayMinutes: integer("time_of_day_minutes").notNull(),
    timezone: text("timezone").notNull(),
    leadTimeMinutes: integer("lead_time_minutes").notNull().default(1440),
    maxItemsPerRun: integer("max_items_per_run").notNull().default(1),
    autoApprove: boolean("auto_approve").notNull().default(false),
    autoSchedule: boolean("auto_schedule").notNull().default(true),
    monthlyBudgetCents: integer("monthly_budget_cents"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    consecutiveFailureCount: integer("consecutive_failure_count")
      .notNull()
      .default(0),
    pausedReason: text("paused_reason"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_schedule_rules_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_schedule_rules_due_index").on(
      table.isEnabled,
      table.nextRunAt,
    ),
    index("marketing_schedule_rules_workspace_enabled_index").on(
      table.workspaceId,
      table.isEnabled,
    ),
    foreignKey({
      columns: [table.campaignId, table.workspaceId],
      foreignColumns: [marketingCampaigns.id, marketingCampaigns.workspaceId],
      name: "marketing_schedule_rules_tenant_campaign_fkey",
    }).onDelete("restrict"),
    check(
      "marketing_schedule_rules_time_valid",
      sql`${table.timeOfDayMinutes} between 0 and 1439`,
    ),
    check(
      "marketing_schedule_rules_items_valid",
      sql`${table.maxItemsPerRun} between 1 and 10`,
    ),
    check(
      "marketing_schedule_rules_month_day_valid",
      sql`${table.frequency} <> 'monthly' or ${table.byMonthDay} between 1 and 28`,
    ),
    check(
      "marketing_schedule_rules_lead_time_valid",
      sql`${table.leadTimeMinutes} between 0 and 43200`,
    ),
    check(
      "marketing_schedule_rules_budget_valid",
      sql`${table.monthlyBudgetCents} is null or ${table.monthlyBudgetCents} >= 0`,
    ),
    check(
      "marketing_schedule_rules_failure_count_valid",
      sql`${table.consecutiveFailureCount} >= 0`,
    ),
  ],
);

export const marketingScheduleRuleRuns = pgTable(
  "marketing_schedule_rule_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    status: marketingScheduleRunStatusEnum("status")
      .notNull()
      .default("claimed"),
    skipReason: text("skip_reason"),
    createdContentItemIds: jsonb("created_content_item_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    runId: uuid("run_id").references(() => marketingGenerationRuns.id, {
      onDelete: "set null",
    }),
    triggerRunId: text("trigger_run_id"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_schedule_rule_runs_occurrence_unique").on(
      table.ruleId,
      table.scheduledFor,
    ),
    uniqueIndex("marketing_schedule_rule_runs_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_schedule_rule_runs_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.ruleId, table.workspaceId],
      foreignColumns: [
        marketingScheduleRules.id,
        marketingScheduleRules.workspaceId,
      ],
      name: "marketing_schedule_rule_runs_tenant_rule_fkey",
    }).onDelete("cascade"),
  ],
);

export const marketingWeeklyDigestStatusEnum = pgEnum(
  "marketing_weekly_digest_status",
  ["generating", "ready", "failed"],
);

/** One immutable reporting snapshot per workspace and UTC week. */
export const marketingWeeklyDigests = pgTable(
  "marketing_weekly_digests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    weekEnd: date("week_end", { mode: "string" }).notNull(),
    status: marketingWeeklyDigestStatusEnum("status")
      .notNull()
      .default("generating"),
    snapshot: jsonb("snapshot").$type<MarketingWeeklyDigestSnapshot>(),
    triggerRunId: text("trigger_run_id"),
    errorCategory: text("error_category"),
    safeErrorMessage: text("safe_error_message"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_weekly_digests_workspace_week_unique").on(
      table.workspaceId,
      table.weekStart,
    ),
    uniqueIndex("marketing_weekly_digests_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    index("marketing_weekly_digests_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    check(
      "marketing_weekly_digests_date_order",
      sql`${table.weekEnd} > ${table.weekStart}`,
    ),
  ],
);

/** Read and explicit acknowledgement are user-specific, not workspace-wide. */
export const marketingWeeklyDigestAcknowledgements = pgTable(
  "marketing_weekly_digest_acknowledgements",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    digestId: uuid("digest_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.digestId, table.userId] }),
    index("marketing_weekly_digest_ack_workspace_user_index").on(
      table.workspaceId,
      table.userId,
    ),
    foreignKey({
      columns: [table.digestId, table.workspaceId],
      foreignColumns: [
        marketingWeeklyDigests.id,
        marketingWeeklyDigests.workspaceId,
      ],
      name: "marketing_weekly_digest_ack_tenant_digest_fkey",
    }).onDelete("cascade"),
  ],
);

export type MarketingSkillInputFieldData = {
  key: string;
  label: string;
  type: "text" | "longtext" | "select" | "number" | "platform";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  minimum?: number;
  maximum?: number;
};

export const marketingSkills = pgTable(
  "marketing_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    instructions: text("instructions").notNull(),
    baseSkillKey: text("base_skill_key").notNull(),
    inputFields: jsonb("input_fields")
      .$type<MarketingSkillInputFieldData[]>()
      .notNull()
      .default([]),
    defaultPlatform: contentPlatformEnum("default_platform"),
    defaultContentKind: marketingContentKindEnum(
      "default_content_kind",
    ).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    version: integer("version").notNull().default(1),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("marketing_skills_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    uniqueIndex("marketing_skills_workspace_slug_active_unique")
      .on(table.workspaceId, table.slug)
      .where(sql`${table.deletedAt} is null`),
    index("marketing_skills_workspace_enabled_index").on(
      table.workspaceId,
      table.isEnabled,
    ),
    check(
      "marketing_skills_instructions_length",
      sql`char_length(${table.instructions}) <= 8000`,
    ),
    check(
      "marketing_skills_input_fields_length",
      sql`jsonb_array_length(${table.inputFields}) <= 10`,
    ),
    check("marketing_skills_version_positive", sql`${table.version} > 0`),
  ],
);

export const auditLogEvents = pgTable(
  "audit_log_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id"),
    action: auditActionEnum("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id"),
    safeMetadata: jsonb("safe_metadata")
      .$type<Record<string, string | number | boolean | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_events_workspace_created_index").on(
      table.workspaceId,
      table.createdAt,
    ),
    index("audit_log_events_workspace_action_created_index").on(
      table.workspaceId,
      table.action,
      table.createdAt,
    ),
    index("audit_log_events_workspace_project_created_index").on(
      table.workspaceId,
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const storageReconciliationCheckpoints = pgTable(
  "storage_reconciliation_checkpoints",
  {
    sweep: text("sweep").primaryKey(),
    lastObjectKey: text("last_object_key"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export const taskHeartbeats = pgTable(
  "task_heartbeats",
  {
    taskId: text("task_id").notNull(),
    environment: text("environment").notNull(),
    lastStartedAt: timestamp("last_started_at", {
      withTimezone: true,
    }).notNull(),
    lastCompletedAt: timestamp("last_completed_at", { withTimezone: true }),
    outcome: text("outcome").notNull(),
    safeMessage: text("safe_message"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.environment] })],
);

export const projectSubtitleSettings = pgTable(
  "project_subtitle_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
    granularity: subtitleGranularityEnum("granularity")
      .notNull()
      .default("sentence"),
    captionStyle: jsonb("caption_style").$type<CaptionStyleData>().notNull(),
    segmentTextOverrides: jsonb("segment_text_overrides")
      .$type<SubtitleSegmentTextOverrides>()
      .notNull()
      .default({}),
    updatedByUserId: uuid("updated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("project_subtitle_settings_project_unique").on(table.projectId),
    uniqueIndex("project_subtitle_settings_id_workspace_unique").on(
      table.id,
      table.workspaceId,
    ),
    foreignKey({
      columns: [table.projectId, table.workspaceId],
      foreignColumns: [projects.id, projects.workspaceId],
      name: "project_subtitle_settings_tenant_project_fkey",
    }).onDelete("cascade"),
  ],
);

export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scopeKey: text("scope_key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("rate_limit_counters_scope_window_unique").on(
      table.scopeKey,
      table.windowStart,
    ),
    index("rate_limit_counters_window_index").on(table.windowStart),
    check("rate_limit_counters_count_nonnegative", sql`${table.count} >= 0`),
  ],
);

export const clerkWebhookEvents = pgTable(
  "clerk_webhook_events",
  {
    deliveryId: text("delivery_id").primaryKey(),
    eventType: text("event_type").notNull(),
    status: webhookStatusEnum("status").default("processing").notNull(),
    attemptCount: integer("attempt_count").default(1).notNull(),
    safeErrorMessage: text("safe_error_message"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("clerk_webhook_events_status_index").on(table.status),
    index("clerk_webhook_events_event_type_index").on(table.eventType),
  ],
);

export type ApplicationUser = typeof users.$inferSelect;
export type UserThemePreference =
  (typeof userThemePreferenceEnum.enumValues)[number];
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceRole = (typeof workspaceRoleEnum.enumValues)[number];
export type StorageObject = typeof storageObjects.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type MediaAssetKind = (typeof mediaAssetKindEnum.enumValues)[number];
export type MediaAssetStatus = (typeof mediaAssetStatusEnum.enumValues)[number];
export type MediaInspectionStatus =
  (typeof mediaInspectionStatusEnum.enumValues)[number];
export type SocialPost = typeof socialPosts.$inferSelect;
export type SocialPostStatus = (typeof socialPostStatusEnum.enumValues)[number];
export type SocialPostMedia = typeof socialPostMedia.$inferSelect;
export type SocialPostTarget = typeof socialPostTargets.$inferSelect;
export type SocialPostTargetStatus =
  (typeof socialPostTargetStatusEnum.enumValues)[number];
export type Character = typeof characters.$inferSelect;
export type CharacterStatus = (typeof characterStatusEnum.enumValues)[number];
export type CharacterReferenceAsset =
  typeof characterReferenceAssets.$inferSelect;
export type CharacterReferenceType =
  (typeof characterReferenceTypeEnum.enumValues)[number];
export type CharacterReferenceSource =
  (typeof characterReferenceSourceEnum.enumValues)[number];
export type CharacterReferenceGeneration =
  typeof characterReferenceGenerations.$inferSelect;
export type CharacterReferenceGenerationStatus =
  (typeof characterReferenceGenerationStatusEnum.enumValues)[number];
export type Project = typeof projects.$inferSelect;
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type ProjectAspectRatio =
  (typeof projectAspectRatioEnum.enumValues)[number];
export type ProjectVideoKind = (typeof projectVideoKindEnum.enumValues)[number];
export type SceneCharacterStageSlot =
  (typeof sceneCharacterStageSlotEnum.enumValues)[number];
export type SceneVersionCharacter = typeof sceneVersionCharacters.$inferSelect;
export type ProjectOutputVariant = typeof projectOutputVariants.$inferSelect;
export type OutputVariantStatus =
  (typeof outputVariantStatusEnum.enumValues)[number];
export type ProjectScriptDraft = typeof projectScriptDrafts.$inferSelect;
export type ProjectScriptVersion = typeof projectScriptVersions.$inferSelect;
export type ProjectBrief = typeof projectBriefs.$inferSelect;
export type ContentPlatform = (typeof contentPlatformEnum.enumValues)[number];
export type ContentIdea = typeof contentIdeas.$inferSelect;
export type ContentIdeaGenerationRun =
  typeof contentIdeaGenerationRuns.$inferSelect;
export type ContentIdeaSource =
  (typeof contentIdeaSourceEnum.enumValues)[number];
export type ScriptGenerationRun = typeof scriptGenerationRuns.$inferSelect;
export type TitleGenerationRun = typeof titleGenerationRuns.$inferSelect;
export type ProjectTitleSuggestion =
  typeof projectTitleSuggestions.$inferSelect;
export type ThumbnailGeneration = typeof thumbnailGenerations.$inferSelect;
export type PlatformConnection = typeof platformConnections.$inferSelect;
export type PlatformConnectionStatus =
  (typeof platformConnectionStatusEnum.enumValues)[number];
export type VideoPublication = typeof videoPublications.$inferSelect;
export type VideoPublicationStatus =
  (typeof videoPublicationStatusEnum.enumValues)[number];
export type PublicationVisibility =
  (typeof publicationVisibilityEnum.enumValues)[number];
export type ThumbnailTextMode =
  (typeof thumbnailTextModeEnum.enumValues)[number];
export type SceneAnalysisRun = typeof sceneAnalysisRuns.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
export type SceneVersion = typeof sceneVersions.$inferSelect;
export type SceneStatus = (typeof sceneStatusEnum.enumValues)[number];
export type ProjectCharacter = typeof projectCharacters.$inferSelect;
export type StylePreset = typeof stylePresets.$inferSelect;
export type StylePresetVersion = typeof stylePresetVersions.$inferSelect;
export type PromptTemplateVersion = typeof promptTemplateVersions.$inferSelect;
export type SceneImageGeneration = typeof sceneImageGenerations.$inferSelect;
export type ImageGenerationSource =
  (typeof imageGenerationSourceEnum.enumValues)[number];
export type SceneVariantFraming = typeof sceneVariantFramings.$inferSelect;
export type SceneFramingMode = (typeof sceneFramingModeEnum.enumValues)[number];
export type ShortComposition = typeof shortCompositions.$inferSelect;
export type ShortClip = typeof shortClips.$inferSelect;
export type ShortCompositionStatus =
  (typeof shortCompositionStatusEnum.enumValues)[number];
export type SceneImageBatch = typeof sceneImageBatches.$inferSelect;
export type SceneImageBatchStatus =
  (typeof sceneImageBatchStatusEnum.enumValues)[number];
export type VoicePreset = typeof voicePresets.$inferSelect;
export type SceneAudioGeneration = typeof sceneAudioGenerations.$inferSelect;
export type AudioGenerationSource =
  (typeof audioGenerationSourceEnum.enumValues)[number];
export type AudioGenerationStatus =
  (typeof audioGenerationStatusEnum.enumValues)[number];
export type AudioReviewStatus =
  (typeof audioReviewStatusEnum.enumValues)[number];
export type AudioOutputFormat =
  (typeof audioOutputFormatEnum.enumValues)[number];
export type SceneAudioAssetFormat =
  (typeof sceneAudioAssetFormatEnum.enumValues)[number];
export type ImageGenerationStatus =
  (typeof imageGenerationStatusEnum.enumValues)[number];
export type ImageReviewStatus =
  (typeof imageReviewStatusEnum.enumValues)[number];
export type GenerationReferenceAsset =
  typeof generationReferenceAssets.$inferSelect;
export type ProviderRequest = typeof providerRequests.$inferSelect;
export type CustomVoice = typeof customVoices.$inferSelect;
export type UsageReservation = typeof usageReservations.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type ProjectSubtitleSettings =
  typeof projectSubtitleSettings.$inferSelect;
export type SubtitleGranularityValue =
  (typeof subtitleGranularityEnum.enumValues)[number];
export type VideoRender = typeof videoRenders.$inferSelect;
export type RenderStatus = (typeof renderStatusEnum.enumValues)[number];
export type WorkspaceBudgetSettings =
  typeof workspaceBudgetSettings.$inferSelect;
export type MarketingSettings = typeof marketingSettings.$inferSelect;
export type MarketingAutonomyLevel =
  (typeof marketingAutonomyLevelEnum.enumValues)[number];
export type MarketingBrandProfile = typeof marketingBrandProfiles.$inferSelect;
export type MarketingOnboardingStatus =
  (typeof marketingOnboardingStatusEnum.enumValues)[number];
export type MarketingBrandAudience =
  typeof marketingBrandAudiences.$inferSelect;
export type MarketingBrandOffer = typeof marketingBrandOffers.$inferSelect;
export type MarketingBrandChannel = typeof marketingBrandChannels.$inferSelect;
export type MarketingOnboardingAnswer =
  typeof marketingOnboardingAnswers.$inferSelect;
export type MarketingBrandAsset = typeof marketingBrandAssets.$inferSelect;
export type MarketingBrandAssetRole =
  (typeof marketingBrandAssetRoleEnum.enumValues)[number];
export type MarketingKnowledgeDocument =
  typeof marketingKnowledgeDocuments.$inferSelect;
export type MarketingKnowledgeDocumentChunk =
  typeof marketingKnowledgeDocumentChunks.$inferSelect;
export type MarketingDocumentStatus =
  (typeof marketingDocumentStatusEnum.enumValues)[number];
export type MarketingDocumentSource =
  (typeof marketingDocumentSourceEnum.enumValues)[number];
export type MarketingBrandContextSnapshot =
  typeof marketingBrandContextSnapshots.$inferSelect;
export type MarketingOperation =
  (typeof marketingOperationEnum.enumValues)[number];
export type MarketingRunStatus =
  (typeof marketingRunStatusEnum.enumValues)[number];
export type MarketingReservationStatus =
  (typeof marketingReservationStatusEnum.enumValues)[number];
export type MarketingGenerationRun =
  typeof marketingGenerationRuns.$inferSelect;
export type MarketingUsageReservation =
  typeof marketingUsageReservations.$inferSelect;
export type MarketingUsageEvent = typeof marketingUsageEvents.$inferSelect;
export type MarketingScheduleRule = typeof marketingScheduleRules.$inferSelect;
export type MarketingSkill = typeof marketingSkills.$inferSelect;
export type MarketingScheduleRuleRun =
  typeof marketingScheduleRuleRuns.$inferSelect;
export type MarketingScheduleFrequency =
  (typeof marketingScheduleFrequencyEnum.enumValues)[number];
export type MarketingScheduleRunStatus =
  (typeof marketingScheduleRunStatusEnum.enumValues)[number];
export type MarketingWeeklyDigest = typeof marketingWeeklyDigests.$inferSelect;
export type MarketingWeeklyDigestAcknowledgement =
  typeof marketingWeeklyDigestAcknowledgements.$inferSelect;
export type MarketingChatThread = typeof marketingChatThreads.$inferSelect;
export type MarketingThreadStatus =
  (typeof marketingThreadStatusEnum.enumValues)[number];
export type MarketingChatMessage = typeof marketingChatMessages.$inferSelect;
export type MarketingChatToolCall = typeof marketingChatToolCalls.$inferSelect;
export type MarketingContentItem = typeof marketingContentItems.$inferSelect;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type MarketingCampaignDestination =
  typeof marketingCampaignDestinations.$inferSelect;
export type MarketingCompetitor = typeof marketingCompetitors.$inferSelect;
export type MarketingResearchSnapshot =
  typeof marketingResearchSnapshots.$inferSelect;
export type MarketingCampaignObjective =
  (typeof marketingCampaignObjectiveEnum.enumValues)[number];
export type MarketingCampaignStatus =
  (typeof marketingCampaignStatusEnum.enumValues)[number];
export type MarketingContentStatus =
  (typeof marketingContentStatusEnum.enumValues)[number];
export type MarketingContentKind =
  (typeof marketingContentKindEnum.enumValues)[number];
export type PerformanceMetricKind =
  (typeof performanceMetricKindEnum.enumValues)[number];
export type PerformanceMetricUnit =
  (typeof performanceMetricUnitEnum.enumValues)[number];
export type PublicationPerformanceSource =
  typeof publicationPerformanceSources.$inferSelect;
export type PublicationMetricObservation =
  typeof publicationMetricObservations.$inferSelect;
export type MarketingChatRole =
  (typeof marketingChatRoleEnum.enumValues)[number];
export type MarketingChatMessageStatus =
  (typeof marketingChatMessageStatusEnum.enumValues)[number];
export type AuditLogEvent = typeof auditLogEvents.$inferSelect;
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
export type GoogleBusinessConnection =
  typeof googleBusinessConnections.$inferSelect;
export type GoogleBusinessLocation =
  typeof googleBusinessLocations.$inferSelect;
export type GoogleBusinessLocationSnapshot =
  typeof googleBusinessLocationSnapshots.$inferSelect;
export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
