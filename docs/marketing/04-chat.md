# Marketing Studio — chat

The chat is the primary surface. It streams, calls skills as tools, persists
everything, and hands long work to Trigger.dev without blocking.

## Dependencies

Three new packages, the first ones in this repository for AI orchestration:

| Package          | Why                                                           |
| ---------------- | ------------------------------------------------------------- |
| `ai`             | `streamText`, `tool`, `stepCountIs`, `convertToModelMessages` |
| `@ai-sdk/openai` | The provider binding                                          |
| `@ai-sdk/react`  | `useChat`                                                     |

The SDK was chosen over hand-rolling because it is **provider-agnostic**: the
seam `docs/idea-lab.md` deliberately preserved ("keep the interface swappable so
Claude can be added later") is exactly what this gives, without a second
bespoke abstraction.

**Version notes to verify at install time:**

- The repo is on **Zod 4.4.3**. AI SDK ≥ 5 supports Zod 4. A mismatch here is a
  silent empty `inputSchema`, not a build error — check a tool's serialised
  schema in the first integration test.
- AI SDK 6 deprecates `generateObject`/`streamObject` in favour of `streamText`
  with `Output.object()`. Use the current idiom, not tutorials written for v4.
- **Confirm the SDK bundles in the Trigger worker before Slice 8.**
  `trigger.config.ts` ships `lib/**` via `additionalFiles` and stubs
  `server-only`, so `lib/marketing/**` is covered — but if the bundle fails,
  keep worker-side provider calls on the existing `openai` client and use the
  AI SDK only in the web runtime. The provider interface makes that split
  survivable.

## The route handler

`app/api/workspaces/[workspaceId]/marketing/chat/route.ts` — **Node runtime**
(it needs `server-only` database access, `secret-box`, and R2),
`export const maxDuration = 300`.

### Order of operations

```text
1  requireAuthenticatedUser()
   requireWorkspaceMembership({ userId, workspaceId })
   requireCapability(role, "useMarketingChat")
2  marketingChatRequestSchema.parse(await request.json())
3  reload history from the database
4  idempotency: insert the user message with request_nonce
5  compile brand context -> system prompt from @studio/prompts
6  reserve the turn on the marketing ledger (operation: chat_turn)
7  streamText({ ... })
8  return result.toUIMessageStreamResponse({ originalMessages, onFinish })
```

The `workspaceId` path parameter is trusted **only after** it has been resolved
against a membership row. This is the same rule as everywhere else in the
codebase and it is easy to forget in a route that "just streams".

### Only the newest message comes from the browser

This is the single most important security decision in the chat.

The request carries `{ threadId, message, forcedSkill, requestNonce }` — **one**
message. History is reloaded from `marketing_chat_messages`. The client cannot
rewrite history, forge an assistant turn that claims a tool already ran, or
inject a system message.

A chat endpoint that accepts a full message array from the browser has handed
the user the system prompt.

### Idempotency

The user message is inserted with `request_nonce` before the stream starts. The
partial unique index on `(thread_id, request_nonce)` means a retried request
raises a unique violation, which is caught and treated as "already accepted" —
resume rather than duplicate. Position comes from `max(position) + 1` under the
`(thread_id, position)` unique index, so two concurrent sends cannot collide.

### Step control

```ts
streamText({
  model: openai(env.MARKETING_CHAT_MODEL),
  system,
  messages: convertToModelMessages(history),
  tools: buildChatTools({ workspaceId, userId, role, threadId, catalogue }),
  toolChoice: forcedSkill
    ? { type: "tool", toolName: forcedSkill.key }
    : "auto",
  stopWhen: stepCountIs(env.MARKETING_CHAT_MAX_STEPS),
  prepareStep,
  onStepFinish,
});
```

`prepareStep` enforces the per-turn cost ceiling: once accumulated usage exceeds
`MARKETING_CHAT_MAX_TURN_COST_CENTS`, it **drops the billable tools from the
step**, so the model must summarise and stop rather than loop. A step limit
alone does not bound cost — six image generations are within six steps.

## Persistence

| When              | What                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Before the stream | User message written, `position = max + 1`                                                                            |
| Stream start      | Assistant row created with `status: 'streaming'`                                                                      |
| `onFinish`        | Final `parts`, tokens, `cost_cents`, `finish_reason`, `provider_request_id`; status → `complete`                      |
| Same transaction  | `reconcileMarketingUsage(runId, actualCostCents)`, bump thread `total_cost_cents`, `message_count`, `last_message_at` |

**`onFinish` must survive client disconnect.** Call `result.consumeStream()` so
persistence and reconciliation complete even if the browser goes away
mid-stream. Without it, a user closing the tab leaves a `streaming` row and a
`pending` reservation forever.

A stream that dies before `onFinish` leaves the message `streaming`; the hourly
reconciler (see `07-cost-governance.md`) settles those and releases the
reservation once `expires_at` passes.

## Long-running work

`execution: 'deferred'` skills never block the stream. They insert a
`marketing_chat_tool_calls` row, trigger a task, and return immediately with
`{ status: "started", toolCallId }`.

### New Trigger tasks

All follow the established house shape — payload of ids only, terminal-status
early return, reservation preflight comparing status, expiry, amount, and
`request_fingerprint` before any provider call, `classify*Error` with rethrow to
retry or terminal-fail in the database.

| Task                                      | Queue                           |
| ----------------------------------------- | ------------------------------- |
| `trigger/marketing-content-generation.ts` | `ai-text`                       |
| `trigger/marketing-image-generation.ts`   | `image-generation`              |
| `trigger/marketing-research.ts`           | `ai-text`                       |
| `trigger/marketing-document-ingestion.ts` | `media-processing`              |
| `trigger/marketing-schedule-sweeper.ts`   | `schedules.task`, `*/5 * * * *` |
| `trigger/marketing-research-refresh.ts`   | `schedules.task`, `0 6 * * *`   |
| `trigger/marketing-usage-reconcile.ts`    | `schedules.task`, hourly        |

Copy the preflight block from `trigger/thumbnail-generation.ts` verbatim; that
block is the house pattern and it is what stops a replayed Trigger run spending
twice.

### Reporting back into the thread

On completion, each task calls
`completeMarketingToolCall({ workspaceId, toolCallId, output })`, which in one
transaction:

1. sets the tool-call row `succeeded`, and
2. **appends a new assistant message** to the thread with
   `parts: [{ type: "data-toolResult", skillKey, summary, contentItemId?, mediaAssetId? }]`.

Failure writes `error_category` and `safe_error_message` and appends an **honest
failure message**. AGENTS.md UI rule 13: do not hide a failed item inside a
generic success state.

### Why polling, not realtime

`GET /api/workspaces/[workspaceId]/marketing/chat/threads/[threadId]/events?sincePosition=N`
returns `{ messages, toolCalls, hasRunningWork }`.

`hooks/useMarketingThreadEvents.ts` polls every 3 seconds **only while
`hasRunningWork` is true**, and stops otherwise.

There is no realtime infrastructure in this repository — no Pusher, no Ably, no
SSE fan-out. Trigger.dev Realtime would require minting a public access token
for the browser and building a second authorization story. Polling a
workspace-scoped, membership-checked endpoint costs roughly one cheap indexed
query every 3 seconds, and only while work is actually in flight.

**Trigger Realtime is documented as the v2 upgrade**, not dismissed.

## Components

One component per file, all in `components/marketing/`:

```text
ChatThreadView.tsx          the useChat host
ChatMessageList.tsx
ChatMessageBubble.tsx
ChatMessagePart.tsx
ChatToolCallCard.tsx        pending / running / succeeded / failed + artifact link
ChatComposer.tsx            hosts the "/" picker
ChatThreadSidebar.tsx
ChatThreadRow.tsx
ChatEmptyState.tsx
ChatErrorState.tsx
ChatCostFooter.tsx          turn and thread cost
ChatStreamingIndicator.tsx
```

`ChatToolCallCard` uses the `--notice-*` tokens from `app/globals.css` via the
existing tone helpers — **never `dark:` palette utilities**, because `.dim` does
not receive them.

## Required behaviour

```text
the browser sends exactly one message; history is server-loaded
a replayed request_nonce does not append a second message
positions are gap-free and monotonic per thread
the turn is reserved before the first token and reconciled in onFinish
onFinish completes even when the client disconnects
per-turn cost ceiling drops billable tools rather than truncating mid-answer
a deferred skill returns immediately and appends its result later
a failed tool call appends an honest failure, never a generic success
polling runs only while work is in flight
every message records its model, prompt version, and brand context snapshot
a viewer cannot reach the endpoint at all
```

## Required tests

```text
request schema rejects a full message array
membership is resolved before workspaceId is trusted
duplicate request_nonce is treated as already-accepted
position allocation under concurrent sends
prepareStep drops billable tools past the cost ceiling
forcedSkill sets toolChoice for one turn only
completeMarketingToolCall appends exactly one assistant message
events endpoint is workspace-scoped and refuses a foreign thread
hasRunningWork is false once every tool call is terminal
```
