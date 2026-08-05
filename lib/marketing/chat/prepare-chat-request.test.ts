import { describe, expect, it } from "vitest";
import { prepareMarketingChatRequest } from "@/lib/marketing/chat/prepare-chat-request";
import { marketingChatRequestSchema } from "@/lib/schemas/marketing-chat-request";

const THREAD_ID = "8f1c2e0a-3b4d-4c5e-9f60-1a2b3c4d5e6f";
const NONCE = "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";

describe("prepareMarketingChatRequest", () => {
  it("prepares a first chat message accepted by the server schema", () => {
    const prepared = prepareMarketingChatRequest({
      threadId: THREAD_ID,
      body: { requestNonce: NONCE },
      messages: [
        {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "Write a launch post." }],
        },
      ],
    });

    expect(marketingChatRequestSchema.safeParse(prepared.body).success).toBe(
      true,
    );
  });

  it("embeds a skill invocation without leaking a top-level property", () => {
    const prepared = prepareMarketingChatRequest({
      threadId: THREAD_ID,
      body: {
        requestNonce: NONCE,
        skillInvocation: {
          type: "data-skillInvocation",
          skillKey: "write_email",
          inputs: { audience: "Past clients" },
        },
      },
      messages: [
        {
          id: "message-1",
          role: "user",
          parts: [{ type: "text", text: "/write_email: Past clients" }],
        },
      ],
    });

    expect(prepared.body).not.toHaveProperty("skillInvocation");
    expect(prepared.body.message?.parts).toContainEqual({
      type: "data-skillInvocation",
      skillKey: "write_email",
      inputs: { audience: "Past clients" },
    });
    expect(marketingChatRequestSchema.safeParse(prepared.body).success).toBe(
      true,
    );
  });
});
