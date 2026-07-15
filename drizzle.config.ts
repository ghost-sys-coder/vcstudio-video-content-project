import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

const migrationDatabaseUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL is required for Drizzle migrations.",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
});
