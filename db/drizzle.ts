import "server-only";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { createRetryingFetch } from "@/db/connect-retry";
import { getDatabaseEnvironment } from "@/lib/env/server";

let database: ReturnType<typeof createDatabase> | null = null;
let client: ReturnType<typeof createClient> | null = null;

function createClient() {
  // The Neon HTTP driver opens a connection per query, so a page issuing
  // several queries concurrently opens several at once. Where the network
  // throttles simultaneous outbound TLS handshakes the surplus ones time out
  // and surface as an unexplained `Failed query`. Retrying only
  // provably-undelivered requests turns that into a slightly slower response
  // instead of an error page, and cannot double-execute a write.
  neonConfig.fetchFunction = createRetryingFetch();
  return neon(getDatabaseEnvironment().DATABASE_URL);
}

function createDatabase() {
  return drizzle({ client: getNeonClient() });
}

/**
 * The driver underneath Drizzle, for the rare write that must be several
 * statements and still all-or-nothing.
 *
 * Almost everything here is expressed as one statement with CTEs precisely
 * because this driver opens a connection per query, so two calls are two
 * transactions. A few writes genuinely cannot be one statement: renumbering
 * scenes after a deletion has to move rows out of the way and back again,
 * because a unique index rejects the intermediate state. `sql.transaction`
 * sends the batch as a single transaction, which is the only way to make such
 * a pair atomic on this driver.
 *
 * Reach for it only when a single statement is genuinely impossible.
 */
export function getNeonClient() {
  client ??= createClient();
  return client;
}

export function getDatabase() {
  database ??= createDatabase();
  return database;
}

export type Database = ReturnType<typeof getDatabase>;
