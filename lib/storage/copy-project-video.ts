import "server-only";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./r2-client";
import { getStorageEnvironment } from "@/lib/env/server";
/** Server-side R2 copy avoids transferring the video through a web request. */
export async function copyProjectVideo(input: {
  sourceKey: string;
  destinationKey: string;
}) {
  const environment = getStorageEnvironment();
  await getR2Client().send(
    new CopyObjectCommand({
      Bucket: environment.R2_BUCKET_NAME,
      Key: input.destinationKey,
      CopySource: `${environment.R2_BUCKET_NAME}/${input.sourceKey.split("/").map(encodeURIComponent).join("/")}`,
    }),
  );
}
