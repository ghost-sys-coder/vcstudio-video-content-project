# Environment variable ownership

Environment files are grouped by the runtime that reads them. Values must not
be copied to another runtime merely for convenience.

| File           | Owner                           | Purpose                                                                                  |
| -------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `.env`         | Local web and local Trigger.dev | Local development superset. Never committed.                                             |
| `.env.vercel`  | Vercel                          | Web routes, server actions, OAuth callbacks, and browser configuration. Never committed. |
| `.env.trigger` | Trigger.dev                     | Background tasks and scheduled workers. Synchronized during deployment. Never committed. |
| `.env.example` | Repository                      | Key catalogue and safe defaults only; contains no real credentials.                      |

## Marketing Studio pause on free tiers

Keep `ENABLE_MARKETING_STUDIO=false` in `.env`, `.env.vercel`, and
`.env.trigger` until the owner explicitly resumes Marketing Studio after credits
are available. A disabled workspace alone does not disable deployment-wide
scheduled invocations. The global switch stops marketing access, schedule
claiming, weekly digests, Google Business synchronization, and performance
refresh before they query PostgreSQL or dispatch new work.

Owners and editors still see a locked **Studio — Paused** sidebar entry. It
opens a static explanation of the credit-saving pause, with no marketing data
query, background dispatch, or enable control. Viewers retain their existing
role restrictions. The active marketing menu still requires both deployment
and workspace switches; displaying the paused entry does not enable the feature.

Pause the marketing-only schedules in the Trigger.dev dashboard as well to avoid
paying for cron invocations that immediately return: `marketing-schedule-sweeper`,
`marketing-weekly-digest`, and `google-business-daily-sync`. Keep them paused
across deployments until the owner requests resumption. Updating a local env
file does not itself update an already deployed worker.

On 2026-10-31 all three production schedules above were deactivated through the
Trigger.dev API and verified inactive. The four non-marketing schedules retained
their previous active states. No worker was deployed or task executed.

Keep the shared 30-minute reservation recovery and six-hour storage sweep.
They protect existing video work and usage reservations; marketing being off
must not strand previously reserved budgets. Do not start or deploy a worker
just to verify a sidebar or dialog change.

## Storage reconciliation

These variables are Trigger.dev-only when deployed. They belong in `.env` for
local development, `.env.trigger` for deployment, and `.env.example` for
documentation. They must not be added to Vercel.

| Variable                                        | Default | Meaning                                                             |
| ----------------------------------------------- | ------: | ------------------------------------------------------------------- |
| `STORAGE_RECONCILIATION_DRY_RUN`                |  `true` | Report candidates without deleting objects or repairing asset rows. |
| `STORAGE_RECONCILIATION_BATCH_SIZE`             |   `100` | Maximum database candidates and R2 objects inspected per sweep.     |
| `STORAGE_RECONCILIATION_ABANDONED_UPLOAD_HOURS` |    `24` | Minimum age before an unreferenced R2 object is abandoned.          |

Run `npm run env:check` before deployment. It compares key names only and never
prints values. Local `trigger dev` reads `.env` and does not update a remote
dashboard. `npm run trigger:deploy` deploys production and synchronizes
`.env.trigger`; use `-- --env staging` for staging.

## Browser security policy

`SECURITY_CSP_MODE` is web-runtime-only. It belongs in `.env`, `.env.vercel`,
and `.env.example`, and must not be copied to Trigger.dev. Start with
`report-only`; switch to `enforce` only after production violation reports and
the sign-in, recording, upload, preview, and OAuth journeys have been checked.

## Operational readiness

`READINESS_ENVIRONMENT` is shared by Vercel and Trigger.dev because the web
dashboard must query the heartbeat written by the matching worker deployment.
Use `development` locally, `staging` in both staging runtimes, and `production`
in both production runtimes. A mismatch truthfully appears as a missing worker.
