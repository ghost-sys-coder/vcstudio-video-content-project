# Environment variable ownership

Environment files are grouped by the runtime that reads them. Values must not
be copied to another runtime merely for convenience.

| File               | Owner                           | Purpose                                                                                  |
| ------------------ | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `.env`             | Local web and local Trigger.dev | Local development superset. Never committed.                                             |
| `.env.vercel`      | Vercel                          | Web routes, server actions, OAuth callbacks, and browser configuration. Never committed. |
| `.env.trigger.dev` | Trigger.dev                     | Background tasks and scheduled workers. Synchronized during deployment. Never committed. |
| `.env.example`     | Repository                      | Key catalogue and safe defaults only; contains no real credentials.                      |

## Storage reconciliation

These variables are Trigger.dev-only when deployed. They belong in `.env` for
local development, `.env.trigger.dev` for deployment, and `.env.example` for
documentation. They must not be added to Vercel.

| Variable                                        | Default | Meaning                                                             |
| ----------------------------------------------- | ------: | ------------------------------------------------------------------- |
| `STORAGE_RECONCILIATION_DRY_RUN`                |  `true` | Report candidates without deleting objects or repairing asset rows. |
| `STORAGE_RECONCILIATION_BATCH_SIZE`             |   `100` | Maximum database candidates and R2 objects inspected per sweep.     |
| `STORAGE_RECONCILIATION_ABANDONED_UPLOAD_HOURS` |    `24` | Minimum age before an unreferenced R2 object is abandoned.          |

Run `npm run env:check` before deployment. It compares key names only and never
prints values. Local `trigger dev` reads `.env` and does not update a remote
dashboard. `npm run trigger:deploy` deploys production and synchronizes
`.env.trigger.dev`; use `-- --env staging` for staging.

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
