import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import {
  findChatThread,
  listChatMessagesSince,
  listMarketingToolCallsForThread,
} from "@/db/repositories/marketing-chat.repository";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { hasRunningMarketingWork } from "@/lib/marketing/chat/tool-call-status";

const querySchema = z.coerce.number().int().min(-1).default(-1);

export async function GET(
  request: Request,
  context: {
    params: Promise<{ workspaceId: string; threadId: string }>;
  },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { workspaceId, threadId } = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "useMarketingChat");
    const thread = await findChatThread({ workspaceId, threadId });
    if (!thread)
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    const url = new URL(request.url);
    const sincePosition = querySchema.parse(
      url.searchParams.get("sincePosition") ?? "-1",
    );
    const [messages, toolCalls] = await Promise.all([
      listChatMessagesSince({
        workspaceId,
        threadId,
        sincePosition,
        limit: 50,
      }),
      listMarketingToolCallsForThread({ workspaceId, threadId }),
    ]);
    return NextResponse.json({
      messages: messages
        .filter((message) => message.status === "complete")
        .map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts,
          position: message.position,
        })),
      toolCalls,
      hasRunningWork: hasRunningMarketingWork(toolCalls),
    });
  } catch {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
}
