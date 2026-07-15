# Phase 4 prompt: Character library and consistency references

Read `AGENTS.md` and `README.md`.

Implement a workspace scoped character library.

## Character requirements

Each character contains:

```text
workspaceId
name
slug
description
visualIdentity
bodyProportions
faceDescription
hairDescription
skinToneDescription
defaultOutfitDescription
personalityNotes
continuityRules
negativeConstraints
status
createdByUserId
createdAt
updatedAt
```

Character status:

```text
draft
active
archived
```

## Character assets

Support:

```text
master reference
front view
three quarter view
side view
full body view
expression reference
outfit reference
pose reference
```

Use private R2 storage and signed upload URLs.

Validate:

```text
content type
file size
image dimensions
workspace ownership
character ownership
object key scope
```

## Scene relationships

Create many to many relationships between scene versions and characters.

Allow users to assign existing characters to scenes.

Store the exact character reference asset identifiers used by each generation.

## User interface

Create:

```text
CharacterLibrary
CharacterGrid
CharacterCard
CreateCharacterDialog
CharacterForm
CharacterDetails
CharacterReferenceGallery
CharacterReferenceCard
CharacterReferenceUploader
CharacterReferenceTypeSelector
CharacterAssignmentDialog
SceneCharacterList
EmptyCharactersState
ArchiveCharacterDialog
```

Apply one component per file.

## Testing

Test:

```text
workspace isolation
character slug uniqueness within workspace
signed upload authorization
file validation
object key safety
scene character assignment
archived character behavior
reference asset ownership
```

Update `README.md` and verify the build.
