# Continuous Learning and Marketing Intelligence

## Document status

- **Status:** Future implementation specification; not implemented.
- **Target area:** Marketing Studio, Social publishing, and AI-assisted video production.
- **Primary objective:** Improve content quality and marketing usefulness over time without allowing an AI model to modify production behavior without evidence, review, isolation, or rollback.
- **Last updated:** 2026-08-11.

This document describes a governed learning system around the deployed foundation models. It does **not** propose an uncontrolled model that retrains itself after every publication. The system learns by collecting structured evidence, retrieving relevant examples, refreshing sourced knowledge, evaluating candidate changes, and promoting only changes that outperform the current production configuration.

## Language and definitions

The following definitions are authoritative for this feature:

- **Continuous learning:** Improving future generation through workspace-scoped feedback, retrieval, evaluation, and controlled configuration changes. It does not mean silently changing model weights.
- **Re-learning:** Re-evaluating prior conclusions when knowledge expires, new evidence arrives, performance changes, or an operator corrects the system.
- **Learning signal:** A structured observation such as an approval, rejection reason, user edit, publication outcome, conversion, or verified factual correction.
- **Strategy version:** An immutable bundle of prompt versions, retrieval policy, scoring rules, model choice, and experiment configuration used for a generation.
- **Champion:** The production strategy version currently preferred for a bounded task, platform, workspace, and content class.
- **Challenger:** A candidate strategy evaluated against the champion before it can receive production traffic.
- **Quality gate:** A deterministic or model-assisted check for factual support, logic, brand fit, repetition, policy, platform suitability, and output completeness.
- **Workspace memory:** Private examples, preferences, corrections, and outcomes learned from one workspace. Workspace memory must never be used to improve another workspace unless an explicit, separately designed consent model is introduced.
- **Global playbook:** Curated, non-customer-specific marketing guidance maintained by VCStudio with provenance, versions, and expiration rules.

## What we are building

VCStudio will gain a feedback-driven marketing intelligence layer that:

1. learns from human review and edits;
2. learns from normalized publication and business outcomes;
3. refreshes marketing knowledge from cited, time-bounded sources;
4. retrieves relevant successful and rejected examples during generation;
5. checks generated content before presenting it to users;
6. evaluates strategy changes offline and through controlled experiments;
7. promotes, pauses, or rolls back strategies through explicit governance; and
8. optionally produces fine-tuning datasets after sufficient clean evidence exists.

The PostgreSQL database remains the authoritative source of learning state. Trigger.dev performs durable ingestion, evaluation, aggregation, and experiment reconciliation. Existing model-provider abstractions remain narrow; this feature does not introduce a separate Python service, vector database, or autonomous agent platform by default.

## Product outcomes

The system should measurably improve:

- approval rate and time to approval;
- factual and logical consistency;
- adherence to brand voice and constraints;
- platform suitability;
- novelty without off-brand variation;
- cost per approved and published item;
- performance against workspace-specific business objectives;
- avoidance of previously rejected patterns; and
- freshness of time-sensitive marketing guidance.

The system must not claim that a pattern is guaranteed to perform. It should present learned recommendations as evidence-backed hypotheses with sample size, time window, and confidence.

## Non-goals

The first implementation will not:

- retrain a foundation model after every generation or post;
- modify production prompts directly from engagement metrics;
- publish experimental content without the existing approval controls;
- treat likes, views, or clicks as proof of factual quality;
- use one customer’s private data for another customer;
- ingest unverified internet claims into brand facts;
- create synthetic performance values for unavailable provider metrics;
- add a vector database before PostgreSQL retrieval is demonstrably insufficient;
- automate prompt promotion without minimum evidence and rollback support; or
- replace human judgment for legal, compliance, safety, or brand-critical decisions.

## Existing foundations

The future system should extend these implemented capabilities:

- immutable brand-context snapshots and context fingerprints;
- cited marketing knowledge documents with freshness controls;
- Google Business Profile facts kept separate from manual brand data;
- versioned prompts, skills, model identifiers, and generation records;
- append-only review events and structured rejection reasons;
- deterministic substantive-edit measurement;
- publication-to-copy, hook, format, prompt, context, and time attribution;
- append-only provider performance observations;
- workspace-scoped cost and quality metrics;
- review-only Marketing Studio generation flows;
- Trigger.dev durable tasks and explicit queues;
- PostgreSQL full-text search for the current bounded corpus; and
- audit logging, workspace authorization, and private object storage.

These foundations mean Phase 1 should concentrate on feedback quality and retrieval rather than replacing existing generation or analytics infrastructure.

## Governing principles

### Evidence before adaptation

No behavior should change because one post performed well or poorly. A recommendation must carry its observation window, comparable sample, metric definition, and confidence classification.

### Quality and performance are separate

The system must score at least four independent dimensions:

1. factual and logical quality;
2. brand and audience fit;
3. human editorial acceptance; and
4. normalized business or platform performance.

A high-performing but misleading post must not teach the system to generate misinformation. A factually correct post with low distribution must not be classified as bad writing without controlling for reach and context.

### Workspace isolation

Every learned example, preference, evaluation, and strategy assignment must include `workspaceId`. All repositories must scope reads by both workspace and entity identifier. Retrieval must be workspace-private by default.

### Immutable provenance

Every generation must preserve the exact strategy, prompt, knowledge snapshot, retrieved examples, model, quality-gate results, and final user edits that produced the published content.

### Human control and rollback

Operators must be able to inspect why a recommendation exists, disable a learned rule, exclude an example, pause an experiment, and restore the previous champion.

### Bounded cost and automation

Every model-assisted evaluation is a billable operation and must use the existing reservation, budget, rate-limit, and reconciliation controls. Scheduled learning tasks must have bounded batches and retry limits.

## High-level architecture

```text
Brand facts + cited research + global playbooks
                       |
Human feedback ---- Evidence store ---- Normalized performance
                       |
                 Learning compiler
                       |
        Workspace strategy + retrieved examples
                       |
                  Content generation
                       |
          Deterministic and model quality gates
                       |
                  Human approval/edit
                       |
                    Publishing
                       |
             Append-only outcome observations
                       |
          Offline evaluation and experiments
                       |
             Promote, pause, or roll back
```

The learning compiler does not rewrite prompts in place. It creates immutable candidate strategy versions from approved evidence and configured policies.

## Learning signals

### Editorial signals

Review interfaces should collect structured reasons in addition to free-form notes:

- off-brand;
- factually incorrect;
- unsupported claim;
- illogical or internally inconsistent;
- repetitive;
- weak opening;
- wrong audience;
- wrong platform format;
- poor call to action;
- excessive length;
- tone mismatch;
- compliance concern;
- stale information; and
- other, with required explanation.

The system should store both the generated version and the user-approved version. A deterministic diff should classify additions, removals, rewrites, claim changes, structural changes, and call-to-action changes. User edits are evidence, not automatically accepted instructions: sensitive or accidental edits must be excludable.

### Performance signals

Performance observations should reuse the existing publication attribution system and remain append-only. Candidate metrics include:

- impressions or reach;
- views;
- watch time and completion rate when available;
- likes, comments, shares, and saves;
- link clicks;
- leads and conversions when reliably attributable;
- spend and paid distribution;
- publication time;
- audience and geography where available; and
- negative signals such as hides, reports, or unsubscribes where providers expose them.

Raw metrics must not be compared directly across platforms. The normalization layer should control for platform, format, account baseline, organic versus paid distribution, observation age, audience size, and campaign objective. Missing metrics remain unavailable rather than becoming zero.

### Knowledge signals

Knowledge inputs require provenance and freshness:

- manually approved brand facts;
- Google Business Profile facts;
- uploaded knowledge documents;
- cited research results;
- platform documentation and policy changes;
- operator-authored global playbooks; and
- verified corrections discovered during review.

Each claim should carry source type, source identifier, captured time, valid-from/valid-until when known, confidence, and review status. Performance observations must never be merged into factual brand claims.

## Proposed data model

All new tables require UUID identifiers, timestamps, foreign keys, workspace indexes, and tenant-integrity constraints.

### `learning_feedback_events`

Append-only human and system feedback:

- `workspaceId`
- `contentItemId` or generation identifier
- `publicationTargetId`, nullable
- `actorUserId`, nullable for system checks
- `source`: `human_review | user_edit | quality_gate | performance_analysis`
- `category`
- `severity`
- `structuredDetails`
- `freeformNote`, nullable
- `excludedAt`, `excludedByUserId`, and exclusion reason
- `createdAt`

### `learning_examples`

Curated examples available to retrieval:

- immutable input and output snapshots;
- approved/published/rejected classification;
- platform, audience, format, objective, and content taxonomy;
- review-summary features;
- normalized performance summary with confidence;
- provenance back to feedback and publication records;
- eligibility and exclusion state; and
- searchable PostgreSQL text representation.

### `learning_hypotheses`

Explicit, testable claims such as “question-led hooks improve 7-day completion for short educational videos in this workspace”:

- scope and segmentation;
- supporting and contradicting observations;
- sample size;
- effect estimate and uncertainty;
- status: `draft | review_required | active | rejected | stale`;
- freshness deadline; and
- reviewer decision.

### `learning_strategy_versions`

Immutable strategy bundles:

- workspace/global scope;
- task and platform;
- model and provider;
- prompt-template versions;
- brand-context policy;
- retrieval policy and limits;
- quality-gate configuration;
- linked hypotheses;
- source strategy version;
- state: `candidate | champion | paused | retired`;
- approval and promotion metadata; and
- fingerprint preventing silent mutation.

### `learning_generation_attribution`

One immutable attribution row per generation:

- strategy version;
- retrieved example identifiers and ranks;
- context snapshot;
- final rendered prompt hash;
- quality-gate run identifiers;
- experiment assignment; and
- generation/provider operation identifiers.

### `learning_evaluation_cases`

Frozen evaluation examples with expected properties, not necessarily one “correct” answer:

- input snapshot;
- required facts and prohibited claims;
- brand and audience constraints;
- expected platform/format properties;
- scoring rubric version;
- origin and consent state; and
- holdout classification.

### `learning_evaluation_runs`

Records champion/challenger comparisons:

- dataset version;
- candidate and baseline strategy versions;
- per-dimension scores;
- cost and latency;
- regression failures;
- evaluator versions;
- status and safe error; and
- promotion recommendation, never automatic authority by itself.

### `learning_experiments`

Controlled production experiments:

- champion and challenger versions;
- eligible segment;
- assignment percentage;
- primary and guardrail metrics;
- minimum sample and duration;
- start/stop/pause state;
- stopping reason; and
- promotion or rollback decision.

## Retrieval design

Start with PostgreSQL full-text search plus structured filters because the corpus is workspace-bounded and the repository already uses PostgreSQL search. Retrieval should:

1. filter by workspace, task, platform, audience, format, and eligibility;
2. retrieve a small, bounded set of relevant examples;
3. deliberately include useful negative examples when the failure mode is relevant;
4. enforce diversity so one successful campaign does not dominate every prompt;
5. exclude stale, disputed, or operator-disabled examples;
6. record every retrieved identifier and score; and
7. keep retrieved content within a configured token budget.

Add embeddings or a vector index only when a measured retrieval evaluation shows PostgreSQL search fails at the expected corpus size. The initial architecture should expose a narrow retriever interface so storage can change without changing prompt construction.

## Generation pipeline

Every learning-aware generation should follow this sequence:

1. Resolve authenticated workspace and capability.
2. Freeze the brand-context snapshot and current knowledge cutoff.
3. Select the champion or assigned challenger strategy.
4. Retrieve bounded workspace examples and global playbook guidance.
5. Construct the versioned prompt outside UI and route handlers.
6. Reserve estimated cost.
7. Generate the candidate.
8. Run deterministic validation.
9. Run model-assisted quality evaluation only where deterministic checks are insufficient.
10. Reject, repair once, or present with warnings according to policy.
11. Store attribution, rendered prompts, checks, costs, and provider identifiers.
12. Present the result for human review.

Automatic repair must be bounded to one or a small configured number of attempts. A repair is another billable provider operation and must not loop until a score passes.

## Quality gates

### Deterministic checks

Implement deterministic checks first:

- required fields and output schema;
- empty, truncated, or malformed output;
- platform length and media constraints;
- duplicate and near-duplicate content;
- banned phrases and required disclaimers;
- unsupported URLs or dangerous markup;
- repeated sentences and excessive phrase reuse;
- brand-name, offer, date, and contact-detail consistency;
- claim-source coverage when factual mode is required; and
- language, locale, and audience requirements.

### Model-assisted checks

Use a separately versioned evaluator for:

- logical coherence;
- contradiction detection;
- unsupported factual claims;
- brand-voice fit;
- audience comprehension;
- hook/body/call-to-action consistency;
- misleading certainty;
- cultural and regional sense-making; and
- whether the content actually answers its brief.

The evaluator must return a typed rubric with evidence spans and confidence. It must not receive performance results for the candidate it is judging, preventing outcome bias from contaminating quality assessment.

### Gate outcomes

- `pass`: present normally;
- `pass_with_warning`: present with specific review warnings;
- `repairable`: perform one bounded repair and re-evaluate;
- `blocked`: do not present as publication-ready; and
- `evaluation_failed`: preserve the generation and tell the user the automated review was unavailable.

## Knowledge refresh and re-learning

Trigger.dev should run bounded refresh workflows:

- detect knowledge reaching its freshness deadline;
- re-fetch only approved external sources;
- preserve old claim versions for reproducibility;
- compare new and prior claims;
- route contradictions and material changes to human review;
- rebuild affected brand-context snapshots;
- mark hypotheses stale when their supporting period expires; and
- re-run only evaluation cases affected by the changed knowledge or strategy.

Re-learning is not deletion of history. Old strategies and claims remain immutable and reproducible; they simply stop being eligible for new generations.

## Evaluation framework

### Dataset construction

Create three separated datasets:

1. **Development set:** used while authoring a challenger.
2. **Validation set:** used for promotion decisions.
3. **Holdout set:** rarely accessed and used to detect overfitting.

Evaluation cases should cover different platforms, audiences, content formats, factuality requirements, brand voices, and known failure modes. Cases derived from customer content require workspace isolation and consent-compatible retention.

### Scoring dimensions

Score independently:

- schema and constraint compliance;
- factual support;
- logic and coherence;
- brand fit;
- audience fit;
- platform fit;
- novelty and duplication;
- human preference;
- latency; and
- estimated and actual cost.

An aggregate score may be shown, but promotion must use dimension-specific guardrails. A challenger cannot compensate for worse factuality with higher stylistic preference.

### Promotion rules

A challenger may be promoted only when:

- it passes every critical factual, safety, and compliance guardrail;
- it has no statistically or operationally meaningful regression on protected dimensions;
- it meets configured minimum case and production sample sizes;
- cost and latency remain within limits;
- results are stable across relevant segments;
- an authorized operator approves promotion during early phases; and
- the previous champion remains available for immediate rollback.

## Experimentation

Production experiments should assign strategy versions deterministically using workspace, task, and generation identifiers. Experiments must:

- exclude legal/compliance-critical tasks unless explicitly approved;
- default to draft generation only, never autonomous publication;
- cap challenger traffic;
- declare a primary metric before starting;
- declare factuality, rejection rate, cost, and latency guardrails;
- avoid changing multiple major variables in one experiment;
- stop automatically on critical quality regression; and
- record assignment before generation so results cannot be reassigned later.

Performance reporting should label causal experiments separately from observational correlations.

## Fine-tuning policy

Fine-tuning is optional and belongs after retrieval and prompt evaluation are mature. It should be considered only when:

- a large, clean, consented dataset exists;
- the target behavior is stable and repeatedly demonstrated;
- retrieval and prompt changes have plateaued;
- provider data-retention and privacy terms are acceptable;
- a holdout evaluation proves improvement;
- deletion and workspace isolation requirements are understood; and
- the cost and operational burden are justified.

Fine-tuning should target stable style or structured transformation behavior, not volatile marketing facts. Current facts remain retrieval-grounded so they can expire and be corrected without retraining.

## Trigger.dev workflows and queues

Proposed tasks:

- `learning-feedback-compiler`: converts review/edit events into eligible examples.
- `learning-performance-normalizer`: updates comparable outcome summaries from append-only observations.
- `learning-knowledge-refresh`: refreshes expiring approved sources.
- `learning-hypothesis-builder`: produces review-required evidence summaries.
- `learning-evaluation-runner`: evaluates champion and challenger strategies.
- `learning-experiment-reconciler`: checks sample, guardrail, stop, and promotion conditions.
- `learning-retention-sweeper`: applies exclusion, retention, and deletion policies.

Suggested queues:

- reuse `ai-text` for billable evaluator/generation calls;
- use `media-processing` only if multimodal evaluation is later approved; and
- add a low-concurrency `learning-analysis` queue for non-urgent aggregation.

Every task must be idempotent. Keys should include workspace, source version, strategy version, evaluator version, dataset version, and operation.

## User experience

### Review feedback

Add fast structured rejection reasons, optional notes, and a clear “exclude this from learning” control. Do not increase review friction so much that users stop providing feedback.

### Learning center

Owners and editors should be able to inspect:

- what the system currently believes works;
- supporting and contradicting evidence;
- sample size, period, and confidence;
- active champion strategies and experiments;
- excluded examples;
- stale knowledge and pending contradictions;
- quality trends and recurring failure modes; and
- cost attributable to learning/evaluation.

Owners should control promotion, experiment activation, retention policy, and workspace learning enablement. Editors may review evidence and provide feedback. Viewers receive read-only access where appropriate.

### Generation explanations

Generated content should expose concise, non-sensitive explanations such as:

- which brand-context version was used;
- which approved strategy influenced the result;
- whether relevant prior examples were retrieved;
- warnings raised by quality gates; and
- why a learned recommendation is considered low, medium, or high confidence.

Do not expose hidden chain-of-thought or raw provider reasoning.

## Authorization, privacy, and security

- Resolve Clerk identity and workspace membership on the server.
- Scope every learning entity and query by `workspaceId`.
- Treat feedback text, generated content, performance, and examples as private customer data.
- Encrypt provider credentials with the existing token-sealing mechanism.
- Never store signed media URLs in learning records or logs.
- Store immutable references to private assets rather than copying binaries into training datasets.
- Make learning opt-out and example exclusion auditable.
- Define retention and deletion propagation before fine-tuning is enabled.
- Do not export customer data to a model-training endpoint without explicit configuration and consent.
- Record strategy promotion, rollback, exclusion, and retention changes in audit logs.
- Validate every external source and webhook payload.

## Cost controls

Add distinct operation types for evaluation, repair, hypothesis generation, and optional embedding generation. Each operation must:

1. estimate cost;
2. enforce workspace daily/monthly and project limits where applicable;
3. reserve spend;
4. execute a bounded provider request;
5. record actual tokens/cost;
6. reconcile or release the reservation; and
7. expose cost in usage and learning dashboards.

Recommended limits include:

- maximum examples retrieved per generation;
- maximum evaluator calls per generation;
- maximum repair attempts;
- evaluation cases per batch;
- challenger traffic percentage;
- learning-analysis daily spend;
- knowledge refresh frequency; and
- maximum hypotheses created per period.

## Observability

Record structured, secret-free events for:

- strategy selection;
- retrieval counts and exclusion reasons;
- gate outcomes and evaluator versions;
- candidate repairs;
- evaluation completion and regressions;
- experiment assignment and stopping;
- strategy promotion and rollback;
- stale knowledge and contradictions; and
- provider request identifiers, error codes, latency, tokens, and cost.

Dashboards should distinguish system health from content quality. A provider outage must not look like a quality regression.

## Phased implementation

### Phase 1 — Feedback foundation

- Define structured editorial feedback taxonomy.
- Persist generated-versus-approved diffs.
- Add learning opt-out and example exclusion.
- Build `learning_feedback_events` and `learning_examples`.
- Add workspace-scoped learning settings.
- Do not change generation behavior yet.

**Exit criteria:** feedback is attributable, private, auditable, and queryable; users can exclude mistakes.

### Phase 2 — Retrieval-informed generation

- Implement bounded PostgreSQL retrieval.
- Add eligible positive and negative examples to versioned prompts.
- Persist retrieval attribution.
- Add duplication and prior-rejection avoidance.
- Compare retrieval-on versus retrieval-off offline.

**Exit criteria:** retrieval improves approval/edit metrics without factual, cost, or latency regression.

### Phase 3 — Quality gates

- Add deterministic checks.
- Add typed model-assisted evaluation.
- Add one bounded repair pass.
- Surface actionable warnings in review UI.
- Build evaluation cases from known production failures.

**Exit criteria:** incoherent and unsupported outputs are detected reliably, false-positive rates are acceptable, and failures never discard user work.

### Phase 4 — Knowledge refresh and hypotheses

- Add claim-level freshness and contradiction workflows.
- Compile normalized performance into review-required hypotheses.
- Build the Learning Center evidence UI.
- Keep all recommendations advisory.

**Exit criteria:** every recommendation is sourced, segmented, time-bounded, and reversible.

### Phase 5 — Champion/challenger evaluation

- Implement immutable strategy versions.
- Create development, validation, and holdout datasets.
- Run offline champion/challenger comparisons.
- Add operator promotion and rollback.

**Exit criteria:** no production strategy can change without passing critical gates and leaving an audit trail.

### Phase 6 — Controlled production experiments

- Add deterministic assignment and traffic caps.
- Monitor primary and guardrail metrics.
- Add automatic pause on critical regression.
- Separate causal experiment results from observational reporting.

**Exit criteria:** experiments can run and roll back without changing already-published history or bypassing review.

### Phase 7 — Fine-tuning decision gate

- Audit dataset volume, cleanliness, consent, retention, and deletion requirements.
- Compare fine-tuning against the champion retrieval/prompt strategy.
- Implement only if it provides a material, reproducible improvement.

**Exit criteria:** a documented go/no-go decision. “No fine-tuning needed” is a valid successful outcome.

## Testing strategy

### Unit tests

- feedback taxonomy and exclusion rules;
- diff classification;
- retrieval filtering, ranking, diversity, and token limits;
- freshness and staleness rules;
- normalization formulas;
- strategy fingerprinting;
- experiment assignment;
- promotion and rollback gates;
- deterministic quality checks;
- idempotency keys; and
- cost estimation.

### PostgreSQL integration tests

- cross-workspace isolation;
- append-only feedback and observations;
- immutable strategy versions;
- atomic champion promotion;
- one champion per scoped task;
- exclusion propagation;
- published-attribution preservation;
- concurrent experiment assignment; and
- retention/deletion behavior.

### Provider and workflow tests

- evaluator schema validation;
- retry and cost reconciliation;
- stale task/idempotency rejection;
- partial provider outage behavior;
- knowledge contradiction routing; and
- bounded repair attempts.

### Evaluation tests

- known incoherent outputs;
- unsupported claims;
- brand violations;
- culturally inappropriate or geographically nonsensical content;
- platform-format mistakes;
- repeated content;
- adversarial feedback and metric gaming; and
- champion/challenger regressions.

### Browser workflows

- submit structured feedback;
- exclude an example;
- inspect evidence;
- review quality warnings;
- approve or reject a strategy promotion;
- pause an experiment; and
- roll back to the previous champion.

## Rollout and rollback

1. Ship collection in shadow mode with no generation impact.
2. Validate feedback quality and tenant isolation.
3. Enable retrieval for internal workspaces behind a feature flag.
4. Run quality gates in report-only mode.
5. Enable blocking only for high-confidence critical failures.
6. Introduce challenger evaluation without production assignment.
7. Enable capped experiments for opted-in internal workspaces.
8. Expand only after quality, cost, and rollback exercises pass.

Every strategy assignment must resolve to a previous champion if the learning subsystem is unavailable. Disabling learning must not disable ordinary generation.

## Proposed environment variables

Names are provisional and should be consolidated by runtime before implementation:

| Variable                           | Runtime              | Purpose                                           |
| ---------------------------------- | -------------------- | ------------------------------------------------- |
| `ENABLE_CONTINUOUS_LEARNING`       | Vercel + Trigger.dev | Global kill switch; default `false`.              |
| `LEARNING_RETRIEVAL_MAX_EXAMPLES`  | Vercel + Trigger.dev | Maximum examples injected per generation.         |
| `LEARNING_RETRIEVAL_MAX_TOKENS`    | Vercel + Trigger.dev | Retrieval context ceiling.                        |
| `LEARNING_EVALUATOR_MODEL`         | Trigger.dev          | Separately versioned quality evaluator.           |
| `LEARNING_MAX_REPAIR_ATTEMPTS`     | Trigger.dev          | Bounded repair attempts; recommended default `1`. |
| `LEARNING_EVALUATION_BATCH_SIZE`   | Trigger.dev          | Cases evaluated per durable batch.                |
| `LEARNING_MAX_CHALLENGER_PERCENT`  | Vercel + Trigger.dev | Hard cap on experiment traffic.                   |
| `LEARNING_KNOWLEDGE_REFRESH_HOURS` | Trigger.dev          | Refresh cadence for eligible expiring sources.    |
| `LEARNING_DAILY_SPEND_LIMIT_CENTS` | Vercel + Trigger.dev | Dedicated evaluation/learning spend ceiling.      |

Secrets should reuse existing provider credentials wherever possible. No new secret should be introduced merely to duplicate an existing OpenAI or storage key.

## Migration plan

Implementation will require new migrations for the proposed tables, enums, constraints, and indexes. Do not edit applied migrations. Recommended order:

1. feedback and examples;
2. evaluation cases and runs;
3. strategy versions and attribution;
4. hypotheses;
5. experiments; and
6. retention/exclusion indexes and audit actions.

Each migration should be deployable while learning is disabled. Existing generation paths must continue working before, during, and after migration.

## Risks and mitigations

| Risk                                                        | Mitigation                                                                               |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Engagement optimization rewards misinformation or clickbait | Separate factuality, brand, human approval, and performance guardrails.                  |
| Feedback loops amplify one accidental success               | Minimum samples, confidence labels, contradictory evidence, and expiry.                  |
| Cross-customer data leakage                                 | Workspace-scoped schema, repositories, retrieval, tests, and no default global training. |
| Prompt drift destroys reproducibility                       | Immutable strategy versions, rendered prompts, fingerprints, and attribution.            |
| Evaluator becomes the new source of nonsense                | Typed rubrics, evidence spans, versioned evaluation sets, and human review.              |
| Cost grows invisibly                                        | Reservations, dedicated limits, bounded batches, and usage reporting.                    |
| Experiments harm production quality                         | Draft-only default, traffic caps, guardrails, automatic pause, and rollback.             |
| Knowledge becomes stale                                     | Claim freshness, re-fetch, contradiction review, and eligibility expiry.                 |
| Users game or poison learning                               | Exclusion, actor attribution, minimum evidence, anomaly checks, and owner controls.      |
| Fine-tuning complicates deletion                            | Do not fine-tune until consent, retention, and deletion behavior are approved.           |

## Decisions to confirm before implementation

These decisions are intentionally deferred until implementation planning:

1. Whether learning is opt-in per workspace or enabled by default with opt-out.
2. Which business outcome is primary for the first experiment.
3. Which roles may approve strategy promotion.
4. Minimum sample sizes and confidence thresholds by content class.
5. Retention duration for generated-versus-approved examples.
6. Whether any anonymized aggregate learning across workspaces will ever be permitted.
7. Which external sources are approved for automated knowledge refresh.
8. Whether model-assisted quality gates begin as warnings or blockers.
9. Whether conversions can be attributed reliably enough to become a learning signal.
10. The evidence threshold that would justify embeddings or fine-tuning.

## Definition of done

The continuous-learning feature is complete only when:

- requested behavior exists without autonomous uncontrolled retraining;
- tenant isolation and authorization are enforced;
- all learning signals have provenance and exclusion controls;
- quality and performance remain independent dimensions;
- strategy changes are immutable, evaluated, auditable, and reversible;
- generation remains available when learning services fail;
- relevant unit, integration, workflow, evaluation, and browser tests pass;
- budgets and cost reconciliation cover every billable call;
- environment documentation is consolidated across Vercel and Trigger.dev;
- migrations and README documentation are current; and
- no known critical privacy, security, factuality, or cross-workspace issue remains.

## Recommended first action when implementation begins

Begin with Phase 1 only: structured editorial feedback, approved-edit diffs, learning opt-out, and example exclusion in shadow mode. Do not change prompts or generation behavior until the collected evidence has been audited for quality and workspace isolation.
