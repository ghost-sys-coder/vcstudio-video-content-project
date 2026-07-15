import { sql } from "drizzle-orm";
import {
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

export const usageReservationStatusEnum = pgEnum("usage_reservation_status", [
  "pending",
  "reconciled",
  "released",
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
    analysisRunId: uuid("analysis_run_id")
      .notNull()
      .references(() => sceneAnalysisRuns.id, { onDelete: "cascade" }),
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
    uniqueIndex("usage_reservations_analysis_unique").on(table.analysisRunId),
    index("usage_reservations_workspace_project_status_index").on(
      table.workspaceId,
      table.projectId,
      table.status,
    ),
    check(
      "usage_reservations_cost_nonnegative",
      sql`${table.reservedCostCents} >= 0`,
    ),
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
export type Project = typeof projects.$inferSelect;
export type ProjectStatus = (typeof projectStatusEnum.enumValues)[number];
export type ProjectAspectRatio =
  (typeof projectAspectRatioEnum.enumValues)[number];
export type ProjectScriptDraft = typeof projectScriptDrafts.$inferSelect;
export type ProjectScriptVersion = typeof projectScriptVersions.$inferSelect;
export type SceneAnalysisRun = typeof sceneAnalysisRuns.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
export type SceneVersion = typeof sceneVersions.$inferSelect;
export type SceneStatus = (typeof sceneStatusEnum.enumValues)[number];
