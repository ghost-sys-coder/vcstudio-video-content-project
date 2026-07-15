# Phase 10 prompt: Usage ledger, budgets, audit logs, and operational hardening

Read `AGENTS.md` and `README.md`.

Implement complete usage accounting and operational safeguards.

## Usage ledger

Track:

```text
workspace
project
user
provider
operation
model
estimated cost
reserved cost
actual cost
input units
output units
status
provider request identifier
workflow run identifier
createdAt
settledAt
```

Use integer minor currency units. Do not use floating point currency values.

## Budgets

Support:

```text
daily workspace budget
monthly workspace budget
project budget
operation specific limits
manual confirmation threshold
```

Prevent new billable operations when available budget is insufficient.

Handle abandoned reservations through a safe reconciliation process.

## Audit logs

Record:

```text
workspace creation
role changes
project deletion or archive
script restoration
scene approval
asset approval
generation start
generation cancellation
render start
export deletion
budget changes
```

Do not record secrets or full signed URLs.

## Administration interface

Create:

```text
UsageDashboard
UsageSummaryCards
UsageByOperationChart
UsageByProjectTable
BudgetSettingsForm
BudgetProgress
UsageEventTable
AuditLogTable
AuditLogFilters
OperationalLimitsForm
```

One component per file.

## Hardening

Add:

```text
rate limits
request deduplication
secure webhook verification
safe error boundaries
Sentry reporting
PostHog events
database query pagination
storage lifecycle documentation
orphan asset reconciliation
stale workflow reconciliation
```

## Testing

Test:

```text
integer currency arithmetic
reservation concurrency
budget race conditions
reservation reconciliation
audit log creation
rate limit behavior
webhook replay handling
orphan cleanup selection
stale workflow selection
```

Update `README.md` and all operational documentation.
