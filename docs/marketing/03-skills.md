# Marketing Studio — skills

A **skill** is a named capability the chat can invoke: `create_social_post`,
`analyse_competitors`, `write_newsletter`. Each maps to one AI SDK tool. Typing
`/` in the composer opens a picker.

## Built-in skills are code; user skills are data

**Built-in skills are code**, one file per definition:

```text
lib/marketing/skills/
  skill-key.ts              MarketingSkillKey union — the extension point
  skill-definition.ts       the MarketingSkillDefinition type
  skill-registry.ts         Record<MarketingSkillKey, MarketingSkillDefinition>
  skill-catalogue.ts        server: registry + user skills, filtered
  compile-user-skill.ts     marketing_skills row -> runtime definition
  build-chat-tools.ts       definitions -> AI SDK tool map
  definitions/
    create-campaign.ts
    write-email.ts
    train-business-knowledge.ts
    write-blog-post.ts
    create-social-post.ts
    create-media-story.ts
    social-media-manager.ts
    create-newsletter.ts
    analyse-competitors.ts
    scan-trends.ts
    create-social-graphic.ts
    search-brand-knowledge.ts
    list-calendar.ts
    schedule-content.ts
```

`skill-registry.ts` is declared
`satisfies Record<MarketingSkillKey, MarketingSkillDefinition>`, so adding a key
to the union without writing its definition is a **type error**, not a runtime
surprise.

## The definition contract

`lib/marketing/skills/skill-definition.ts`:

| Field                  | Purpose                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `key`                  | Tool name, `/` slash token, and ledger `skill_key` — one identifier, three uses              |
| `label`, `description` | Picker UI, and the description the **model** sees when choosing a tool                       |
| `group`                | Picker grouping: Content, Planning, Research, Knowledge                                      |
| `capability`           | A `WorkspaceCapability`, checked **server-side** in `execute`                                |
| `inputSchema`          | A Zod object — doubles as the AI SDK tool schema **and** the `SkillInputDialog` field source |
| `billing`              | Discriminated union (below)                                                                  |
| `execution`            | `'inline' \| 'deferred'` — a correctness decision, not a preference                          |
| `operation`            | The `marketing_operation` ledger value                                                       |
| `rateLimitOperation`   | Which rate-limit window it consumes                                                          |
| `requiresBrandProfile` | Hidden or disabled until onboarding completes                                                |
| `promptVersion`        | From `@studio/prompts`                                                                       |
| `render(input, ctx)`   | Renders the final prompt — **never inline prompt text**                                      |

### The billing union

```ts
type SkillBilling =
  | { kind: "free" }
  | {
      kind: "text";
      estimate(input): { inputTokens: number; outputTokens: number };
    }
  | { kind: "image"; imageCount: number; quality: ImageQuality }
  | { kind: "research"; queries: number };
```

Discriminated so the cost estimator is exhaustive: a new billing kind that has
no estimator branch fails to compile.

### `inline` versus `deferred`

`inline` resolves inside the streaming response. `deferred` dispatches to
Trigger.dev and returns immediately.

**This is a correctness decision.** A slow `inline` skill will hit the Vercel
function duration limit and take the whole chat turn with it. Anything that
generates an image, renders video, or calls a research provider is `deferred`.
Text generation under a few seconds may be `inline`.

## The built-in catalogue

Every skill named in the original request appears here.

| Key                        | Skill                               | Billing  | Execution | Capability                |
| -------------------------- | ----------------------------------- | -------- | --------- | ------------------------- |
| `create_campaign`          | **Create a campaign**               | text     | inline    | `useMarketingChat`        |
| `write_email`              | **Write an email**                  | text     | inline    | `useMarketingChat`        |
| `train_business_knowledge` | **Train the AI about the business** | text     | inline    | `manageBrandProfile`      |
| `write_blog_post`          | **Write a blog post**               | text     | deferred  | `useMarketingChat`        |
| `create_social_post`       | **Create a social post**            | text     | inline    | `useMarketingChat`        |
| `create_media_story`       | **Create a media story**            | text     | inline    | `useMarketingChat`        |
| `social_media_manager`     | **Social media manager**            | text     | deferred  | `useMarketingChat`        |
| `create_newsletter`        | **Create a newsletter**             | text     | deferred  | `useMarketingChat`        |
| `create_social_graphic`    | Create a social graphic             | image    | deferred  | `useMarketingChat`        |
| `analyse_competitors`      | Analyse competitors                 | research | deferred  | `runMarketingResearch`    |
| `scan_trends`              | Scan trends                         | research | deferred  | `runMarketingResearch`    |
| `search_brand_knowledge`   | Search brand knowledge              | **free** | inline    | `useMarketingChat`        |
| `list_calendar`            | Show the calendar                   | **free** | inline    | `useMarketingChat`        |
| `schedule_content`         | Schedule approved content           | **free** | inline    | `approveMarketingContent` |
| `create_video_draft`       | Draft a video to the storyboard     | text     | deferred  | `useMarketingChat`        |

### `social_media_manager` grows with the autonomy level

At `manual` it proposes a week of posts **as drafts requiring approval**, and
stops. At `assisted` those drafts publish themselves once approved. At
`autonomous` it approves within caps too.

The skill's code does not branch on autonomy — it always produces content items.
What changes is what the surrounding system does with them, which is governed by
`marketing_settings` and the schedule rules, not by the skill. That separation
is what keeps the ladder in one place; see `09-automation.md`.

Its tool description must state the **current** level's behaviour, or the model
will promise autonomy the workspace has not enabled.

### `create_video_draft` — semi-automated video, Slice 9

The video pipeline is this repository's most valuable asset and most of the
owner's content is video, so leaving it entirely manual would under-serve the
goal. The skill automates the cheap stages and stops at the gate immediately
before the expensive one:

```text
create project → write brief → generate script → run scene analysis → STOP at storyboard
```

Everything before the stop costs cents; scene image generation across N scenes
costs dollars, which is precisely why the storyboard is already the approval
gate in the existing pipeline.

**It reuses the existing `script_generation` and `scene_analysis` operations,
ledger, and reservations unchanged** — it orchestrates, it does not
reimplement. Its tool description must say it produces a project ready to
review, not a finished video.

Fully unattended video is Slice 14. See `09-automation.md`.

## Mapping to AI SDK tools

`build-chat-tools.ts` takes `{ workspaceId, userId, role, threadId, catalogue }`
and returns `Record<string, Tool>`. Each `execute` is a **thin adapter** — all
logic lives in `lib/`, never in the route handler body and never in a component:

```text
1  requireCapability(role, definition.capability)
2  enforceRateLimit({ workspaceId, operation: definition.rateLimitOperation })
3  if billing.kind !== "free":
     render the prompt via @studio/prompts
     estimate cost (estimateTokens + calculateTextCostCents, or image helpers)
     insert marketing_generation_runs
     reserveMarketingUsage(...)   -> throws MarketingBudgetExceededError
4  inline:   call provider -> reconcile -> return a compact JSON result
   deferred: insert marketing_chat_tool_calls (running)
             tasks.trigger(..., { idempotencyKey: run.idempotencyKey })
             return { status: "started", toolCallId, note: "..." }
```

Step 1 is not redundant with the UI. The model can attempt any tool it has been
handed; the capability check in `execute` is the only thing that actually stops
it.

## The `/` picker

### The catalogue is filtered on the server

The chat page (a server component) calls
`loadMarketingSkillCatalogue({ workspaceId, role })`, which filters by
`can(role, capability)`, by `requiresBrandProfile` against onboarding status,
and by provider configuration (research skills are hidden when no research key
is set). The result is passed down as a prop.

**The browser never learns about a skill it may not run, and never decides what
it may run.** Both halves matter.

### Components

One component per file, in `components/marketing/`:

```text
SkillPickerPopover.tsx        the popover shell
SkillPickerItem.tsx           one row
SkillPickerEmptyState.tsx     no match / none available
SkillInputDialog.tsx          renders fields from inputSchema
SkillInputField.tsx           one field
SkillCostBadge.tsx            estimated cost
SkillConfirmCostCheckbox.tsx  over-threshold confirmation
```

### Interaction

`/` typed at the start of an empty composer, or immediately after a newline,
opens the popover. Typing filters. `Enter` or click selects. `Escape` closes and
leaves the literal `/` in place — a user typing "20% off / free shipping" must
not be hijacked.

Full keyboard navigation, visible focus states, `aria-activedescendant` on the
composer, and the list marked `role="listbox"` — AGENTS.md UI rules 2–4 are not
optional.

### Selecting a skill does not call a tool directly

It composes a **normal user message** whose `parts` carry an extra
`{ type: "data-skillInvocation", skillKey, inputs }` part. The route reads that
part and, **for that one turn only**, sets
`toolChoice: { type: "tool", toolName: skillKey }`.

Two reasons this is better than invoking the tool directly:

1. The transcript stays a plain conversation, so retry, edit, and history all
   keep working with no special cases.
2. The model still phrases the result, rather than the UI dumping raw JSON at
   the user.

## Gating a skill that costs money

Two layers. **Only the second is authoritative.**

**UI — advisory.** The catalogue entry carries `estimatedCostRangeCents`.
`SkillInputDialog` shows a live estimate as inputs change. If the estimate meets
or exceeds `loadEffectiveWorkspaceBudget().manualConfirmationThresholdCents`,
the submit button is disabled until an explicit confirmation checkbox is ticked.
This satisfies AGENTS.md: "Make generation costs visible before confirmation."

**Server — authoritative.** `reserveMarketingUsage` inside `execute` refuses
when the budget is exhausted, and the Trigger task re-runs the reservation
preflight before touching a provider. A crafted request that skips the dialog
gains nothing at all.

## User-authored skills

Stored in `marketing_skills`. **Owner only** (`manageMarketingSkills`) — a user
skill is prompt text that will be executed later, possibly on a schedule.

`compile-user-skill.ts` turns a row into a runtime definition, introducing
**no new code path**:

- `baseSkillKey` resolves to a built-in executor (default: the generic text
  executor);
- `inputFields` compiles to a Zod object via `buildUserSkillInputSchema`;
- `instructions` is injected as one extra, clearly delimited prompt layer.

### Validation — `lib/schemas/marketing-skill.ts`

| Field          | Rule                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `slug`         | `/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/`, **rejected if it collides with any `MarketingSkillKey`** |
| `instructions` | Trimmed, ≤ 8,000 characters, control characters stripped                                            |
| `inputFields`  | `z.discriminatedUnion("type", …)`, ≤ 10 fields, unique keys, closed field-type set                  |
| `baseSkillKey` | Must be in an explicit **allow-list of delegatable built-ins**                                      |

The slug collision rule stops a user skill shadowing `create_social_post` in the
picker. The `baseSkillKey` allow-list means a user skill **cannot** delegate to
`create_social_graphic` (image spend) or `analyse_competitors` (provider spend)
in v1 — user-authored prompt text may not reach an executor with separate
image, research, campaign, knowledge, or video side effects. It can only refine
the normal budget-reserved text-writing path.

Field types are a closed set: `text | longtext | select | number | platform`.

### Injection defence

User instructions are inserted into a fixed, delimited section carrying a
preamble stating that they may refine tone and structure but may **not** override
the rules above, request tool use, or reveal system content.

**Tool descriptions and the tool list are never derived from user text.** That
is the property that matters: a user skill can influence _how_ a chosen executor
writes, never _which_ executor runs or _whether_ money is spent.

## Required behaviour

```text
a skill key missing a definition fails to compile
capability is enforced inside execute, not only in the UI
the catalogue sent to the browser excludes skills the role cannot run
selecting a skill produces a normal user message, not a direct tool call
toolChoice is forced for exactly one turn
a deferred skill returns within the streaming response without waiting
a user skill cannot take a built-in slug
a user skill cannot delegate to a paid executor
cost is displayed before a billable skill runs
an over-threshold estimate requires explicit confirmation
"/" mid-sentence does not open the picker
Escape leaves the literal "/" in the composer
```

## Required tests

```text
skill registry exhaustiveness (type-level and runtime key parity)
catalogue filtering by role for owner / editor / viewer
catalogue hides research skills when no provider is configured
catalogue hides brand-dependent skills before onboarding completes
buildUserSkillInputSchema rejects >10 fields and duplicate keys
slug validation rejects every MarketingSkillKey
baseSkillKey rejects a non-allow-listed executor
cost estimate matches the reserved amount for each billing kind
execute refuses without the capability even when the tool is offered
```
