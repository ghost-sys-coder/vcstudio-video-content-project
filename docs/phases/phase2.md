# Phase 2 prompt: Project management and script versioning

Read `AGENTS.md` and `README.md`.

Implement project creation, project listing, project settings, script editing, and script versioning.

## Project requirements

A project contains:

```text
workspaceId
name
description
status
aspectRatio
width
height
framesPerSecond
language
maximumBudgetCents
createdByUserId
createdAt
updatedAt
archivedAt
```

Initial project statuses:

```text
draft
planning
assetGeneration
review
readyToRender
rendering
completed
failed
archived
```

## Script requirements

Implement:

```text
one active script per project
immutable script versions
draft editing
explicit version creation
version history
restore previous version by creating a new version
character count
estimated narration duration
script validation
```

Never overwrite historical script content.

## User interface

Create:

```text
ProjectListPageContent
CreateProjectDialog
CreateProjectForm
ProjectCard
EmptyProjectsState
ProjectHeader
ProjectSettingsForm
ScriptEditor
ScriptStatistics
ScriptVersionHistory
ScriptVersionItem
RestoreScriptVersionDialog
ProjectStatusBadge
```

Every named component must have its own PascalCase file.

Keep logic in services, repositories, commands, schemas, and hooks.

## Security

Every project mutation must verify:

```text
authenticated user
active workspace membership
required workspace role
project workspace ownership
valid state transition
```

## Testing

Test:

```text
project isolation
project creation authorization
project update authorization
script validation
script version immutability
script restoration
project state transition validation
budget field validation
pagination
```

## Documentation and verification

Update `README.md` and `.env.example` if necessary.

Run all required verification commands and report actual results.

Do not implement AI scene analysis yet.
