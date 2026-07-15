import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
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
