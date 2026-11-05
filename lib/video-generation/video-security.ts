import "server-only";
import { z } from "zod";
import { decodeEncryptionKey } from "@/lib/crypto/secret-box";
const schema = z.object({
  IDEMPOTENCY_HASH_SECRET: z.string().min(32),
  PLATFORM_TOKEN_ENCRYPTION_KEY: z.string().refine((value) => {
    try {
      decodeEncryptionKey(value);
      return true;
    } catch {
      return false;
    }
  }, "A valid storage encryption key is required."),
});
export function getVideoSecurityEnvironment() {
  return schema.parse(process.env);
}
