import "server-only";

import {
  clerkWebhookEnvironmentSchema,
  databaseEnvironmentSchema,
  storageEnvironmentSchema,
  projectEnvironmentSchema,
  sceneAnalysisEnvironmentSchema,
  sceneImageEnvironmentSchema,
  characterEnvironmentSchema,
  type ClerkWebhookEnvironment,
  type DatabaseEnvironment,
  type StorageEnvironment,
  type ProjectEnvironment,
  type SceneAnalysisEnvironment,
  type SceneImageEnvironment,
  type CharacterEnvironment,
} from "@/lib/env/server-schema";

let databaseEnvironment: DatabaseEnvironment | null = null;
let clerkWebhookEnvironment: ClerkWebhookEnvironment | null = null;
let storageEnvironment: StorageEnvironment | null = null;
let projectEnvironment: ProjectEnvironment | null = null;
let sceneAnalysisEnvironment: SceneAnalysisEnvironment | null = null;
let sceneImageEnvironment: SceneImageEnvironment | null = null;
let characterEnvironment: CharacterEnvironment | null = null;

export function getDatabaseEnvironment(): DatabaseEnvironment {
  databaseEnvironment ??= databaseEnvironmentSchema.parse(process.env);
  return databaseEnvironment;
}

export function getClerkWebhookEnvironment(): ClerkWebhookEnvironment {
  clerkWebhookEnvironment ??= clerkWebhookEnvironmentSchema.parse(process.env);
  return clerkWebhookEnvironment;
}

export function getStorageEnvironment(): StorageEnvironment {
  storageEnvironment ??= storageEnvironmentSchema.parse(process.env);
  return storageEnvironment;
}

export function getProjectEnvironment(): ProjectEnvironment {
  projectEnvironment ??= projectEnvironmentSchema.parse(process.env);
  return projectEnvironment;
}

export function getSceneAnalysisEnvironment(): SceneAnalysisEnvironment {
  sceneAnalysisEnvironment ??= sceneAnalysisEnvironmentSchema.parse(
    process.env,
  );
  return sceneAnalysisEnvironment;
}

export function getSceneImageEnvironment(): SceneImageEnvironment {
  sceneImageEnvironment ??= sceneImageEnvironmentSchema.parse(process.env);
  return sceneImageEnvironment;
}

export function getCharacterEnvironment(): CharacterEnvironment {
  characterEnvironment ??= characterEnvironmentSchema.parse(process.env);
  return characterEnvironment;
}
