import { readFileSync } from "node:fs";

const files = [".env.example", ".env", ".env.trigger", ".env.vercel"];
const keysByFile = new Map(
  files.map((file) => {
    try {
      const keys = new Set(
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .map((line) => /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line)?.[1])
          .filter(Boolean),
      );
      return [file, keys];
    } catch {
      return [file, null];
    }
  }),
);

const rules = {
  ...Object.fromEntries(
    [
      "ENABLE_ELEVENLABS",
      "ELEVEN_LABS_API_KEY",
      "ELEVENLABS_USAGE_MODE",
      "ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED",
      "ELEVENLABS_INTERNAL_DEPLOYMENT",
      "ELEVENLABS_VISUALS_ENABLED",
      "ELEVENLABS_TTS_MODEL",
      "ELEVENLABS_TTS_COST_PER_MILLION_CHARACTERS_CENTS",
      "ELEVENLABS_IMAGE_PRICING_JSON",
      "IMAGE_GENERATION_PROVIDER",
      "ENABLE_VIDEO_GENERATION",
      "GOOGLE_AI_VIDEO_GENERATION_API_KEY",
      "RUNWAYML_API_SECRET",
      "LUMA_AGENTS_API_KEY",
      "VIDEO_GENERATION_MAX_COST_CENTS",
      "VIDEO_GENERATION_DAILY_BUDGET_CENTS",
      "VIDEO_GENERATION_LIFETIME_BUDGET_CENTS",
      "VIDEO_GENERATION_PRICING_JSON",
    ].map((key) => [
      key,
      {
        required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
        forbidden: [],
      },
    ]),
  ),
  ENABLE_PRIVATE_ACCESS: {
    required: [".env.example", ".env", ".env.vercel"],
    forbidden: [".env.trigger"],
  },
  PRIVATE_ACCESS_CLERK_USER_IDS: {
    required: [".env.example", ".env", ".env.vercel"],
    forbidden: [".env.trigger"],
  },
  ENABLE_MCP: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
  // Read by the web app (start dialog) and the worker (every step).
  ENABLE_PRODUCTION_RUNS: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
  PRODUCTION_RUN_DEFAULT_MAX_COST_CENTS: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
  LINKEDIN_API_VERSION: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
  LINKEDIN_PAGES_CLIENT_ID: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
  LINKEDIN_PAGES_CLIENT_SECRET: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
  STORAGE_RECONCILIATION_DRY_RUN: {
    required: [".env.example", ".env", ".env.trigger"],
    forbidden: [".env.vercel"],
  },
  STORAGE_RECONCILIATION_BATCH_SIZE: {
    required: [".env.example", ".env", ".env.trigger"],
    forbidden: [".env.vercel"],
  },
  STORAGE_RECONCILIATION_ABANDONED_UPLOAD_HOURS: {
    required: [".env.example", ".env", ".env.trigger"],
    forbidden: [".env.vercel"],
  },
  E2E_CLERK_USER_EMAIL: {
    required: [".env.example", ".env"],
    forbidden: [".env.trigger", ".env.vercel"],
  },
  SECURITY_CSP_MODE: {
    required: [".env.example", ".env", ".env.vercel"],
    forbidden: [".env.trigger"],
  },
  READINESS_ENVIRONMENT: {
    required: [".env.example", ".env", ".env.vercel", ".env.trigger"],
    forbidden: [],
  },
};
const failures = [];
for (const [key, rule] of Object.entries(rules)) {
  for (const file of rule.required) {
    const keys = keysByFile.get(file);
    if (keys && !keys.has(key)) failures.push(`${key} is missing from ${file}`);
  }
  for (const file of rule.forbidden)
    if (keysByFile.get(file)?.has(key))
      failures.push(`${key} must not be in ${file}`);
}
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Environment variable placement is valid.");
