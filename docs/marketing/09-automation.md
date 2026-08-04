# Marketing Studio — automation

**Automation is the purpose of this feature, not a phase of it.**

The existing video pipeline is deliberately manual — a human gate between every
stage, because one video costs several dollars and an hour of attention. The
Marketing Studio is the opposite shape: it must produce a steady stream of
on-brand content with as little human input as the operator is willing to give
up. If it needs the same per-artifact attention as the video pipeline, it has
failed.

This document defines how far it goes, what unlocks each step, and how to stop
it.

## The ladder

`marketing_settings.autonomy_level` is a three-value enum. It is a **workspace
setting**, and individual schedule rules may sit _below_ it but never above it.

| Level        | Generation                 | Approval          | Publishing | Human touches per week |
| ------------ | -------------------------- | ----------------- | ---------- | ---------------------- |
| `manual`     | On request only            | Every item        | Manual     | ~20                    |
| `assisted`   | Schedule rules + requests  | Every item        | Automatic  | ~5                     |
| `autonomous` | Schedule rules + the agent | Automatic, capped | Automatic  | ~1 (a weekly review)   |

The "human touches" column is the point. Each rung removes a category of work,
not a step in a workflow.

### `manual` — Slices 0–10

Nothing happens without a request. The operator asks in chat or presses
Generate; every artifact goes to the approval queue; approved items are handed
off and scheduled by hand.

This is where the feature is _usable_ but not yet _useful_ in the sense the
owner asked for. It exists to prove the generation quality is good enough to
trust, and to build the evidence the next rung requires.

### `assisted` — Slice 11, the realistic destination

Schedule rules generate content on a timer. The operator reviews a queue rather
than commissioning each piece. Approved items publish themselves at their
scheduled time through the existing path.

**What is automated:** deciding what to make, making it, formatting it per
platform, scheduling it, publishing it, and reporting the outcome.
**What is not:** saying yes.

This is the realistic destination for most of the first year. One review session
per week replaces roughly twenty individual commissions.

### `autonomous` — Slice 14

The agent approves its own output within caps and publishes without a review
step. The operator receives a **weekly digest** of what went out, what it cost,
and what performed, and can retract anything.

Auto-approval is never unconditional. It applies only when **all** of the
following hold, evaluated server-side per item:

```text
the item was produced by a schedule rule whose rule.auto_approve is true
the workspace autonomy_level is 'autonomous'
the item's kind is in the rule's allowed kinds
the item passed the brand-safety checks below
the daily auto-approved item count is under marketing_settings.daily_max_generated_items
the rule is under its monthly_budget_cents
the workspace is under its daily and monthly budget
```

Any one failing sends the item to the approval queue instead. **Falling back to
review is always the safe failure, and it is never silent** — the item carries
the reason it was not auto-approved.

## Graduation criteria

Each rung unlocks on evidence, not on elapsed time. These are the conditions to
check before raising the workspace setting.

### `manual` → `assisted`

```text
30 or more items generated and reviewed
approval rate at or above 80% without substantive edits
zero cross-workspace or authorization defects
the schedule sweeper has run for 7 days with correct once-only firing
per-rule budget caps demonstrated to pause a rule rather than overspend
```

The approval rate is the substantive one. If the operator rewrites four in five
drafts, the prompt or the brand context is wrong, and automating that produces
five times the rewriting.

### `assisted` → `autonomous`

```text
60 or more items published through the assisted path
approval rate at or above 90% without substantive edits
zero brand-safety violations reaching the queue in the last 30 days
the kill switch tested in production
a weekly digest that the operator has actually read for 4 consecutive weeks
spend within forecast for 4 consecutive weeks
```

The digest criterion is deliberate. Autonomy without a review habit is not
autonomy; it is an unmonitored process.

## Brand-safety checks

Auto-approval requires passing a set of **deterministic, testable** checks —
`lib/marketing/automation/brand-safety.ts`, a pure function over the item and
the brand profile. Not an LLM judging itself.

| Check            | Rule                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| Banned phrases   | No phrase from `marketing_brand_profiles.banned_phrases` appears                 |
| Claim guard      | No unsupported superlative or guarantee pattern (regex list, brand-configurable) |
| Compliance terms | Regulated terms from `compliance_notes` require a human                          |
| Length           | Within the platform's `maxCharacters` per the capability matrix                  |
| Link policy      | Only http(s) links, only to allow-listed domains                                 |
| Media presence   | Satisfies `checkPlatformEligibility` for every target platform                   |
| Duplication      | Body fingerprint does not match anything published in the last 30 days           |

The duplication check matters more than it looks: an automated system with a
narrow brand context will converge on saying the same thing, and the operator
will notice long after the audience does.

A failed check is not an error. It routes the item to review with the failing
check named.

## The kill switch

`marketing_settings.autonomy_level = 'manual'` is the switch, and it must take
effect **immediately and everywhere**:

```text
the schedule sweeper stops claiming rules for that workspace
in-flight generation completes but its output lands in needs_review
nothing auto-approves
nothing auto-publishes
already-scheduled social_posts still publish  -- see below
```

The last line is a deliberate decision. Posts already handed off live in
`social_posts` and are claimed by the existing `social-post-scheduler`. Reaching
into that path to cancel them would mean marketing manipulating the publish
queue, which contradicts the one-owner rule in `05-content-and-publishing.md`.

**To stop those, the operator unschedules them in the Social composer**, which
is where scheduled posts already live and where the control already exists. The
UI must say so explicitly when autonomy is switched off, with a link and a count
of what is still queued. A kill switch that leaves the user guessing what it did
not stop is worse than none.

`ENABLE_MARKETING_STUDIO=false` is the harder switch: it stops the sweeper
entirely, for every workspace.

## What automation covers

Mapping the owner's requirements to the ladder.

| Requirement                            | `manual`             | `assisted`                       | `autonomous`                     |
| -------------------------------------- | -------------------- | -------------------------------- | -------------------------------- |
| Generate branded and unbranded content | On request           | On a schedule                    | On a schedule                    |
| Fit each platform                      | Capability matrix    | Capability matrix                | Capability matrix                |
| Organic posting                        | Manual publish       | **Automatic**                    | **Automatic**                    |
| Paid ad creative                       | On request, exported | On a schedule, exported          | On a schedule, exported          |
| Competitor analysis                    | On request           | **Weekly refresh**               | **Weekly refresh, feeds briefs** |
| Trend tracking                         | On request           | **Daily refresh**                | **Daily refresh, feeds briefs**  |
| Video creation                         | Manual pipeline      | **Semi-automated to storyboard** | Semi-automated to storyboard     |
| Approvals                              | Every item           | Every item                       | Capped auto-approval             |

Paid creative stays export-only at every rung — that is a v1 API-integration
boundary, not an autonomy one.

## Semi-automated video — Slice 9

The video pipeline is the repository's most valuable asset and the owner's
content creation is largely video. Leaving it entirely manual would under-serve
the stated goal.

`create_video_draft` automates the **cheap** stages and stops at the gate
immediately before the expensive one:

```text
create a project from the chat context
write the brief          (brief fields already exist in project_briefs)
generate the script      (existing script_generation operation)
run scene analysis       (existing scene_analysis operation)
STOP at the storyboard
```

Everything up to that point costs cents. The next step — scene image generation
across N scenes — costs dollars, which is exactly why the storyboard is already
the approval gate in the existing pipeline. The skill hands the operator a
project that is ready to review rather than a blank one.

**It reuses the existing operations, ledger, and reservations unchanged.** No
second script generator, no second scene analyser. The skill orchestrates; the
pipeline does the work and bills it the way it already does.

Fully unattended video — proceeding through image generation and render without
a human — is Slice 14 and inherits the `autonomous` graduation criteria plus its
own per-video budget cap.

## Reporting

Automation is only acceptable if it reports. Three surfaces, all built from data
already stored:

- **Home** — what ran in the last 7 days, what is queued, what needs review,
  spend against budget, and any paused rule with its reason.
- **Weekly digest** — generated Monday by
  `trigger/marketing-weekly-digest.ts`: items published per platform, spend,
  approval rate, rules that paused, research that refreshed. Written into the
  chat thread as an assistant message, so it is where the operator already
  looks and can be asked follow-up questions in place.
- **`/app/usage`** — the money view, grouped by operation and campaign.

The digest is not a nice-to-have. It is the artifact the `autonomous`
graduation criteria depend on, and the mechanism by which an operator who has
stopped approving individual items still knows what their business is saying.

## Required behaviour

```text
autonomy_level is workspace-scoped; a rule may sit below it, never above
raising autonomy is owner-only and audited
auto-approval evaluates every gate server-side, per item
any failed gate routes to review with the reason named
brand-safety checks are deterministic and unit-tested, never an LLM self-judgement
duplicate content within 30 days is blocked from auto-approval
the kill switch stops claiming, approving, and publishing immediately
the kill switch states what it did not stop, with a link and a count
a paused rule always records why it paused
the weekly digest is produced even in a week with no activity
```

## Required tests

```text
auto-approval refuses when any single gate fails, for each gate
autonomy_level = manual halts sweeper claiming mid-schedule
a rule cannot exceed the workspace autonomy level
brand-safety rejects a banned phrase, an over-length body, and a duplicate
duplication fingerprint window is exactly 30 days and workspace-scoped
kill switch leaves already-handed-off social_posts untouched
digest generation with zero activity produces an honest empty report
create_video_draft stops at the storyboard and never triggers image generation
```
