import "server-only";

import { neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createRetryingFetch } from "@/db/connect-retry";
import { getDatabaseEnvironment } from "@/lib/env/server";

let database: ReturnType<typeof createDatabase> | null = null;

function createDatabase() {
  // The Neon HTTP driver opens a connection per query, so a page issuing
  // several queries concurrently opens several at once. Where the network
  // throttles simultaneous outbound TLS handshakes the surplus ones time out
  // and surface as an unexplained `Failed query`. Retrying only
  // provably-undelivered requests turns that into a slightly slower response
  // instead of an error page, and cannot double-execute a write.
  neonConfig.fetchFunction = createRetryingFetch();
  return drizzle(getDatabaseEnvironment().DATABASE_URL);
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}

export type Database = ReturnType<typeof getDatabase>;
