import { readFileSync } from "node:fs";

const files = [".env.example", ".env", ".env.trigger.dev", ".env.vercel"];
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
  STORAGE_RECONCILIATION_DRY_RUN: {
    required: [".env.example", ".env", ".env.trigger.dev"],
    forbidden: [".env.vercel"],
  },
  STORAGE_RECONCILIATION_BATCH_SIZE: {
    required: [".env.example", ".env", ".env.trigger.dev"],
    forbidden: [".env.vercel"],
  },
  STORAGE_RECONCILIATION_ABANDONED_UPLOAD_HOURS: {
    required: [".env.example", ".env", ".env.trigger.dev"],
    forbidden: [".env.vercel"],
  },
  E2E_CLERK_USER_EMAIL: {
    required: [".env.example", ".env"],
    forbidden: [".env.trigger.dev", ".env.vercel"],
  },
  SECURITY_CSP_MODE: {
    required: [".env.example", ".env", ".env.vercel"],
    forbidden: [".env.trigger.dev"],
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
