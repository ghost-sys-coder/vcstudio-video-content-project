import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { getStorageEnvironment } from "@/lib/env/server";

let client: S3Client | null = null;

export function getR2Client(): S3Client {
  const environment = getStorageEnvironment();
  client ??= new S3Client({
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
    endpoint: environment.R2_ENDPOINT,
    region: environment.R2_REGION,
  });
  return client;
}
