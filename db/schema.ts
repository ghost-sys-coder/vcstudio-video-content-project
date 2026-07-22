import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
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
export const contentPlatformEnum = pgEnum("content_platform", [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
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
  "script_restored",
  "scene_approved",
  "asset_approved",
  "generation_started",
  "generation_cancelled",
  "render_started",
  "export_deleted",
  "budget_changed",
  "limits_changed",
  "platform_connected",
  "platform_disconnected",
  "video_published",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
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
        sql`${table.type} in ('master', 'front', 'threeQuarter', 'side', 'fullBody')`,
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
    size: text("size").notNull(),
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
      "scene_image_batches_size_supported",
      sql`${table.size} in ('1536x1024', '1024x1536', '1024x1024')`,
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
    stylePresetVersionId: uuid("style_preset_version_id").notNull(),
    promptTemplateVersionId: uuid("prompt_template_version_id")
      .notNull()
      .references(() => promptTemplateVersions.id, { onDelete: "restrict" }),
    generationVersion: integer("generation_version").notNull(),
    requestNonce: uuid("request_nonce").notNull(),
    status: imageGenerationStatusEnum("status").notNull().default("pending"),
    reviewStatus: imageReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    batchId: uuid("batch_id"),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    model: text("model").notNull(),
    quality: imageQualityEnum("quality").notNull(),
    size: text("size").notNull(),
    outputFormat: imageOutputFormatEnum("output_format").notNull(),
    outputCompression: integer("output_compression").notNull(),
    background: text("background").notNull().default("opaque"),
    inputFidelity: text("input_fidelity"),
    promptTemplateVersion: text("prompt_template_version").notNull(),
    stylePresetVersion: integer("style_preset_version").notNull(),
    finalPrompt: text("final_prompt").notNull(),
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
    uniqueIndex("scene_image_generations_approved_scene_version_unique")
      .on(table.sceneVersionId)
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
      sql`${table.outputCompression} between 1 and 100`,
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
    voicePresetId: uuid("voice_preset_id").notNull(),
    generationVersion: integer("generation_version").notNull(),
    requestNonce: uuid("request_nonce").notNull(),
    status: audioGenerationStatusEnum("status").notNull().default("pending"),
    reviewStatus: audioReviewStatusEnum("review_status")
      .notNull()
      .default("pending"),
    triggerRunId: text("trigger_run_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    voice: text("voice").notNull(),
    format: audioOutputFormatEnum("format").notNull(),
    speedScaledPercent: integer("speed_scaled_percent").notNull(),
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
      sql`${table.speedScaledPercent} between 25 and 400`,
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
    providerOperationStage: text("provider_operation_stage"),
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
export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceRole = (typeof workspaceRoleEnum.enumValues)[number];
export type StorageObject = typeof storageObjects.$inferSelect;
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
export type ProjectScriptDraft = typeof projectScriptDrafts.$inferSelect;
export type ProjectScriptVersion = typeof projectScriptVersions.$inferSelect;
export type ProjectBrief = typeof projectBriefs.$inferSelect;
export type ContentPlatform = (typeof contentPlatformEnum.enumValues)[number];
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
export type SceneImageBatch = typeof sceneImageBatches.$inferSelect;
export type SceneImageBatchStatus =
  (typeof sceneImageBatchStatusEnum.enumValues)[number];
export type VoicePreset = typeof voicePresets.$inferSelect;
export type SceneAudioGeneration = typeof sceneAudioGenerations.$inferSelect;
export type AudioGenerationStatus =
  (typeof audioGenerationStatusEnum.enumValues)[number];
export type AudioReviewStatus =
  (typeof audioReviewStatusEnum.enumValues)[number];
export type AudioOutputFormat =
  (typeof audioOutputFormatEnum.enumValues)[number];
export type ImageGenerationStatus =
  (typeof imageGenerationStatusEnum.enumValues)[number];
export type ImageReviewStatus =
  (typeof imageReviewStatusEnum.enumValues)[number];
export type GenerationReferenceAsset =
  typeof generationReferenceAssets.$inferSelect;
export type ProviderRequest = typeof providerRequests.$inferSelect;
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
export type AuditLogEvent = typeof auditLogEvents.$inferSelect;
export type AuditAction = (typeof auditActionEnum.enumValues)[number];
export type RateLimitCounter = typeof rateLimitCounters.$inferSelect;
