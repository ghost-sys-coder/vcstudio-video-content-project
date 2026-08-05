# Marketing Studio — implementation slices

Fifteen slices (0–14). Each is independently shippable, independently
verifiable, and adds tables in **exactly one** migration — so `db/schema.ts` (a
single ~3,700 line file) never has two schema changes in flight.

**The destination is Slice 14, autonomous operation.** Slices 0–10 build the
machine and prove its output is trustworthy; Slice 11 makes it semi-automated;
Slice 14 removes the last routine human step. Read `09-automation.md` for the
ladder and the criteria that unlock each rung.

## Prerequisite — before Slice 0

**`npm run db:migrate` is currently broken.** The `drizzle.__drizzle_migrations`
journal records 30 applied migrations while 43+ exist on disk, because later
changes were applied with `drizzle-kit push`. Replaying from the journal re-runs
already-applied DDL and dies on `CREATE TYPE "content_idea_source"`.

This feature adds roughly **twenty tables**. Applying that with `push` and
hand-verifying `pg_indexes` each time is not a viable plan, and production has
no `push` history to fall back on.

```text
Reconcile the migration journal before Slice 0 begins.
```

This is not a nice-to-have. It is the first task.

## Definition of done for every slice

Per AGENTS.md, a slice is complete only when all of the following pass:

```text
npm run format
npm run lint
npm run typecheck
npx vitest run
npm run build
migration generated, reviewed, applied, and hand-verified
README.md updated with a dated "Recent major changes" entry
.env.example synchronised with any new variables
```

Additionally, every slice that adds a route updates the README's route list, and
every slice that adds a Trigger task updates the Trigger.dev setup section and
states that a **dev and prod deploy** is required before the behaviour is live.

---

## Slice 0 — Foundations

**Ships:** `ENABLE_MARKETING_STUDIO` flag, six new capabilities in
`lib/policies/workspace-policy.ts`, `marketing_settings` table,
`MarketingNavigationGroup`, the `marketing/` layout with its flag and capability
gate, Home with empty states, and the settings page.

**Migration:** `marketing_settings`.

**Verify:** navigation visible to owner and editor, absent for viewer; flag off
produces `notFound()` on every marketing route **and** hides the nav; settings
round-trip.

**Watch:** copy the `key={String(isSectionActive)}` remount trick from
`SocialNavigationGroup.tsx` — without it the collapsible will not open on
navigation.

---

## Slice 1 — Brand profile and onboarding

**Ships:** brand profile, audiences, offers, channels, onboarding answers; the
`brand/**` routes and the Q&A wizard. **No AI whatsoever** — this is a form.

**Migration:** five brand tables.

**Verify:** complete the wizard, reload, everything reads back; the completeness
meter reflects answered sections; the primary-audience partial unique index
rejects a second primary.

**Why no AI here:** it lets the entire onboarding surface ship and be used
before the ledger exists. Synthesis arrives in Slice 4.

---

## Slice 2 — Knowledge documents and brand assets

**Ships:** `marketing_knowledge_documents`, `marketing_brand_assets`, the
two-phase upload routes, `assets/**`. Text extraction for `.txt` and `.md` only,
inline, **no new dependency and no LLM**.

**Migration:** two tables + the GIN index on `to_tsvector(extracted_text)`.

**Verify:** upload a `.md`, watch it reach `ready`, toggle
`include_in_context`; a cross-workspace `objectKey` is rejected at complete;
`sanitizeMediaFileName` handling of a hostile filename.

**Defer:** PDF and DOCX parsing to a later slice with its own dependency
justification.

---

## Slice 3 — The marketing usage ledger

**The most important slice in the feature.**

**Ships:** `marketing_generation_runs`, `marketing_usage_reservations`,
`marketing_usage_events`; `reserveMarketingUsage`, `reconcileMarketingUsage`,
release; **`lib/budgets/committed-spend.ts`**; the `/app/usage` marketing
section; the rate-limit union extension and the new env group. First customer:
the **document summariser** Trigger task, which retroactively gives Slice 2's
documents their `summary` and `key_facts`.

**Migration:** three tables + the `marketing_operation` enum.

**Verify:** summarise a document, see the cost in `/app/usage`; set the daily
budget below the estimate and watch the refusal; **spend to the daily limit in
the video pipeline and confirm marketing is then refused** — this is the
combined-budget test and it is the one that must not be skipped.

**Trigger deploy required** (dev + prod) before the summariser runs.

---

## Slice 4 — Brand context compilation

**Ships:** `packages/prompts/src/marketing-brand-context.ts`,
`marketing_brand_context_snapshots`, `compileBrandContext`, the
`brand/context` preview page, and profile synthesis from raw answers.

**Migration:** one table.

**Verify:** deterministic fingerprint across shuffled input ordering; an
unrelated touch does not create a new snapshot; truncation is visible and names
the omitted count; the preview's token estimate matches the compiler's.

---

## Slice 5 — Chat MVP

**Ships:** `ai`, `@ai-sdk/openai`, `@ai-sdk/react`; chat threads and messages;
the streaming route handler; persistence with `consumeStream`; per-turn ledger
reservation; brand context in the system prompt. **Exactly one tool:**
`search_brand_knowledge`.

**Migration:** two tables.

**Verify:** ask a question answerable only from an uploaded document and get a
grounded answer; the turn cost appears in the footer and in `/app/usage`; close
the tab mid-stream and confirm the message still persists and the reservation
still reconciles.

**Watch:** verify the Zod 4 × AI SDK pairing by asserting a tool's serialised
`inputSchema` is non-empty — a mismatch is silent.

---

## Slice 6 — Skills v1

**Ships:** the skill definition contract, registry, catalogue, `build-chat-tools`,
`marketing_chat_tool_calls`, the `/` picker with its input dialog and cost
badge, forced `toolChoice`. Built-ins: `create_social_post`, `write_email`,
`write_blog_post`, `create_newsletter`, `create_media_story`,
`train_business_knowledge`. All `inline`, all text.

**Migration:** one table.

**Verify:** `/` opens the picker; `/` mid-sentence does not; `Escape` leaves the
literal character; a viewer sees no skills; an editor sees no owner-only skills;
cost is shown before sending; an over-threshold estimate requires the checkbox.

---

## Slice 7 — Content items, approvals, and the handoff

**Ships:** content items, media, revisions; the `content/**` approval queue;
`create-post-from-content-item.ts`; `createSocialPostForContentItem`; the
marketing calendar read model.

**Migration:** three tables.

**Verify:** generate a post in chat → it appears in the approval queue → approve
it → it appears in `/app/social/posts` as a draft → schedule it → **it publishes
through the existing, untouched path**. Then confirm the negative cases: a
cross-workspace asset id is refused; a second handoff for the same item is
refused by the partial unique index; `ad_creative` cannot be handed off.

---

## Slice 8 — Deferred work and images

**Ships:** the deferred execution path, the tool-call polling endpoint and hook,
`trigger/marketing-content-generation.ts`,
`trigger/marketing-image-generation.ts`, and `create_social_graphic` writing
into `media_assets`.

**Migration:** none.

**Verify:** ask for a graphic, keep chatting while it runs, see the result
appear in the thread; kill the worker mid-run and confirm the reconciler
settles it; confirm polling stops once nothing is running.

**Watch:** confirm the AI SDK bundles cleanly in the Trigger worker **before**
building on it. If it does not, keep worker-side provider calls on the existing
`openai` client — the provider interface makes that split survivable.

**Trigger deploy required.**

---

## Slice 9 — Campaigns, paid creative, and semi-automated video

**Ships:** `marketing_campaigns`, the campaign tabs, `create_campaign`, the
`ad_creative` payload kind and its export, and **`create_video_draft`** — the
skill that drives brief → script → scene analysis and **stops at the
storyboard**, reusing the existing `script_generation` and `scene_analysis`
operations and their reservations unchanged.

**Migration:** one table.

**Verify:** build a campaign, generate ad copy variants, export as CSV; confirm
ad items are excluded from the handoff; confirm `traffic_type` selects the paid
prompt variant rather than an `if` inside a shared template. For video: confirm
the skill produces a reviewable project at the storyboard and **never triggers
scene image generation** — that is the expensive gate and it stays human.

---

## Slice 10 — Research

**Ships:** the research provider interface and Tavily implementation, the
registry, competitors, snapshots, the `research/**` routes,
`analyse_competitors`, `scan_trends`, and the daily refresh task.

**Migration:** two tables.

**Verify:** analyse a competitor and confirm every finding renders a citation;
force an uncited synthesis and confirm the run **fails validation** rather than
storing it; unset the API key and confirm the research skills vanish from the
picker; let a snapshot expire and confirm the UI marks it stale.

**Trigger deploy required.**

---

## Slice 11 — Recurring schedules

**Ships:** `marketing_schedule_rules`, `marketing_schedule_rule_runs`, the
sweeper, the recurrence UI, auto-approve and auto-schedule gates, per-rule caps.

**Migration:** two tables.

**Verify:** a weekly rule produces a draft on time and **exactly once** under
two concurrent sweeps (the `(rule_id, scheduled_for)` unique index); a rule at
its monthly cap records `skip_reason` and auto-pauses after three consecutive
skips; a monthly rule set to day 31 is rejected at validation.

**Prerequisite:** the per-rule caps, the daily item cap, and the shared budget
must all exist **before** this ships. They are cheap now and expensive after a
weekend of unattended generation.

**Trigger deploy required.**

---

## Slice 12 — User-authored skills

**Status:** implemented on 2026-08-05.

**Ships:** `marketing_skills`, the owner-only editor, `compile-user-skill`,
validation.

**Migration:** one table.

**Verify:** author a skill and invoke it via `/`; confirm a slug matching a
built-in is rejected; confirm a `baseSkillKey` outside the allow-list is
rejected; confirm an editor cannot reach the editor at all.

---

## Slice 13 — Integrations and orchestration

**Ships:** the `integrations` page reusing `ConnectedAccountsPanel`, provider
configuration status, `social_media_manager`, and
`trigger/marketing-weekly-digest.ts`.

**Migration:** none.

**Verify:** connection health reflects reality including an expired token; ask
for a week's plan and confirm it produces drafts; confirm the Monday digest is
produced **even in a week with no activity** and reports honestly rather than
staying silent.

---

## Slice 14 — Autonomous operation

**The destination.** Everything before this is the ramp.

**Ships:** `autonomy_level: 'autonomous'` enabled, capped auto-approval,
`lib/marketing/automation/brand-safety.ts` (deterministic, unit-tested — never
an LLM judging its own output), the kill switch with its "what it did not stop"
disclosure, and fully unattended video behind its own per-video budget cap.

**Migration:** none — the columns shipped in Slice 0.

**Do not start this slice until the graduation criteria in `09-automation.md`
are met**, in particular: 60+ items published through the assisted path, ≥90%
approval without substantive edits, zero brand-safety violations in 30 days,
the kill switch tested in production, and four consecutive weeks of a digest the
operator actually read.

**Verify:** every auto-approval gate refuses independently; a banned phrase, an
over-length body, and a 30-day duplicate each route to review with the reason
named; the kill switch halts claiming mid-schedule and states the count of
already-handed-off posts it did not stop; unattended video respects its cap.

---

## Risk register

| Risk                                  | Mitigation                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Shared-budget double-spend**        | `committed-spend.ts` in Slice 3 with an explicit cross-ledger test. The highest-probability money bug.             |
| **Migration fragility**               | Journal reconciled first; `generate` + `migrate` only; one table-adding slice at a time; single-column CHECKs.     |
| **Prompt injection via documents**    | Summaries only reach prompts; tool descriptions never derived from user text; nothing in context authorises spend. |
| **Zod 4 × AI SDK mismatch**           | Assert a serialised tool schema is non-empty in Slice 5. Silent failure otherwise.                                 |
| **AI SDK in the Trigger worker**      | Verify bundling before Slice 8; fall back to the `openai` client worker-side.                                      |
| **Vercel streaming duration**         | `inline` vs `deferred` is a correctness decision on each skill definition, not a preference.                       |
| **Unattended schedules overspending** | Per-rule caps, daily item caps, auto-pause — all required before Slice 11.                                         |
| **Research hallucination**            | `sourceIndexes.min(1)` enforced by schema; validation failure beats an unsourced claim.                            |
| **A second publish path**             | Marketing never publishes. Reviewed explicitly at Slice 7.                                                         |

## Sequencing rationale

The order is not arbitrary. Three constraints drive it:

1. **Money before spending.** The ledger (3) precedes every AI slice. The
   document summariser is its first customer specifically so the ledger is
   exercised by something small before the chat depends on it.
2. **Grounding before generation.** Brand profile (1), documents (2), and
   compiled context (4) all precede the chat (5), so the first thing the AI ever
   says is already on-brand. Building the chat first would mean building it
   twice.
3. **Approval before automation — because automation is the goal.** The approval
   queue and handoff (7) precede deferred work (8), recurring schedules (11),
   and autonomy (14). This is not caution for its own sake: the approval rate
   measured in slices 7–10 is the **evidence** that decides whether autonomy is
   safe to switch on. Without a period of humans saying yes or no, there is no
   basis for letting the system say yes to itself, and the graduation criteria
   in `09-automation.md` would be unmeasurable.
