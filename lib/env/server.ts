import "server-only";

import {
  clerkWebhookEnvironmentSchema,
  databaseEnvironmentSchema,
  storageEnvironmentSchema,
  type ClerkWebhookEnvironment,
  type DatabaseEnvironment,
  type StorageEnvironment,
} from "@/lib/env/server-schema";

let databaseEnvironment: DatabaseEnvironment | null = null;
let clerkWebhookEnvironment: ClerkWebhookEnvironment | null = null;
let storageEnvironment: StorageEnvironment | null = null;

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
