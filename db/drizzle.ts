import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseEnvironment } from "@/lib/env/server";

let database: ReturnType<typeof createDatabase> | null = null;

function createDatabase() {
  return drizzle(getDatabaseEnvironment().DATABASE_URL);
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}

export type Database = ReturnType<typeof getDatabase>;
