import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import {
  MarketingBudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { resolveMarketingAccess } from "@/lib/marketing/marketing-access";
import { startChatTurn } from "@/lib/marketing/chat/run-chat-turn";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { marketingChatRequestSchema } from "@/lib/schemas/marketing-chat-request";

/**
 * Node, not Edge: the turn reads the database, compiles brand context, and
 * signs idempotency keys, none of which belong in an Edge runtime.
 */
export const runtime = "nodejs";

/**
 * Five minutes. A turn that calls a tool and then writes a long answer can run
 * well past a default timeout, and a stream cut off by the platform leaves a
 * half-written message the user has already paid for.
 */
export const maxDuration = 300;

/**
 * The chat endpoint.
 *
 * Thin on purpose. Everything that decides anything — ordering, reservation,
 * persistence, settlement — lives in `startChatTurn`, where it can be read as
 * one sequence and tested without a request.
 *
 * What stays here is the part that must not move: the `workspaceId` in the URL
 * is a string a browser typed, and it is trusted only after a membership row
 * has been resolved for the authenticated user. That check is easy to overlook
 * in a route whose job appears to be "just stream".
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  let workspaceId: string;
  let workspaceName: string;
  let userId: string;

  try {
    const user = await requireAuthenticatedUser();
    ({ workspaceId } = await context.params);
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "useMarketingChat");
    workspaceName = membership.workspaceName;
    userId = user.id;
  } catch {
    return NextResponse.json(
      { error: "You cannot use the Marketing Studio in this workspace." },
      { status: 403 },
    );
  }

  // Both switches, re-checked per request rather than trusted from the page
  // that rendered the composer: a workspace switched off mid-conversation must
  // stop spending immediately, not at the next full page load.
  const access = await resolveMarketingAccess({ workspaceId });
  if (!access.available)
    return NextResponse.json(
      {
        error:
          access.reason === "deployment_disabled"
            ? "Not found."
            : "The Marketing Studio is switched off for this workspace.",
      },
      { status: access.reason === "deployment_disabled" ? 404 : 409 },
    );

  const parsed = marketingChatRequestSchema.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    await enforceRateLimit({ workspaceId, operation: "marketing_chat_turn" });
    const { response, threadId } = await startChatTurn({
      context: { workspaceId, workspaceName, userId },
      request: parsed.data,
    });
    // The client needs the id of a thread the server just created; a header
    // carries it without disturbing the message stream the SDK is parsing.
    response.headers.set("x-marketing-thread-id", threadId);
    return response;
  } catch (error) {
    if (error instanceof RateLimitExceededError)
      return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof MarketingBudgetExceededError)
      return NextResponse.json(
        {
          error:
            "This workspace has reached its spending limit. Raise it in workspace settings to continue.",
        },
        { status: 402 },
      );
    return NextResponse.json(
      { error: "That message could not be sent. Try again." },
      { status: 500 },
    );
  }
}
