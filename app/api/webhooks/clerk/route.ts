import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { processClerkWebhook } from "@/lib/auth/process-clerk-webhook";
import { getClerkWebhookEnvironment } from "@/lib/env/server";

export async function POST(request: NextRequest): Promise<Response> {
  const deliveryId = request.headers.get("svix-id");

  if (!deliveryId) {
    return Response.json(
      { error: "Missing webhook delivery ID." },
      { status: 400 },
    );
  }

  let event;

  try {
    event = await verifyWebhook(request, {
      signingSecret: getClerkWebhookEnvironment().CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch {
    return Response.json(
      { error: "Webhook verification failed." },
      { status: 400 },
    );
  }

  try {
    const status = await processClerkWebhook({ deliveryId, event });
    return Response.json({ status });
  } catch {
    return Response.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
