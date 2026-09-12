/**
 * Every prompt template version this build recognises, and the check a worker
 * runs before spending money against one.
 *
 * **The defect this replaces.** Each worker used to compare a job's prompt
 * version against the single newest version compiled into itself, and fail the
 * job outright when they differed. The website and the workers deploy
 * separately, so they are routinely a few minutes apart, and in that window
 * every generation died with an error rather than waiting. The check was asking
 * whether the job was newest, when what it needs to ask is whether the job is
 * genuine.
 *
 * Those are different questions. The worker never composes a prompt: it sends
 * the exact text stored on the generation row when the job was created. The
 * template check exists to confirm that the template a job cites is a real
 * published one whose source has not been altered underneath it. A version
 * this build has not heard of fails that test for a completely different
 * reason, and deserves a completely different answer.
 *
 * **Superseded versions stay listed forever.** Removing one would make every
 * generation that ever used it unverifiable, which is the same outage in slow
 * motion. Each hash below is the sha256 of that version's template source; all
 * of them were recovered from the published history and cross-checked against
 * the rows already in the database.
 */

import {
  CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH,
  CHARACTER_REFERENCE_PROMPT_VERSION,
  SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_IMAGE_PROMPT_VERSION,
  SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_OUTPAINT_PROMPT_VERSION,
  THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
  THUMBNAIL_PROMPT_VERSION,
} from "@studio/prompts";

export type PromptTemplateKey =
  "scene-image" | "scene-outpaint" | "character-reference" | "thumbnail";

export interface KnownPromptTemplate {
  templateKey: PromptTemplateKey;
  version: string;
  sourceHash: string;
}

/**
 * Retired versions, kept so jobs created against them stay verifiable.
 *
 * Never edit an entry. A published template is a historical fact, and changing
 * one here would silently bless a source that no longer matches what was sent.
 * When a prompt is bumped, append the version it replaced.
 */
const RETIRED_PROMPT_TEMPLATES: readonly KnownPromptTemplate[] = [
  {
    templateKey: "scene-image",
    version: "scene-image-v1",
    sourceHash:
      "090b20021aad93426915c8cd257c1c96478380e9bf88b503dcac83ce8d8800f5",
  },
  {
    templateKey: "scene-image",
    version: "scene-image-v2",
    sourceHash:
      "d1d0224d441c3ceaa941ca8da724cce56ebd7f2de4e8ea795d567f1cbd459fea",
  },
  {
    templateKey: "scene-outpaint",
    version: "scene-outpaint-v1",
    sourceHash:
      "edf57d722c63ce2f42ed6fa89787b8aef2694e8968ac0f96453d3b1f417b5f97",
  },
  {
    templateKey: "character-reference",
    version: "character-reference-v1",
    sourceHash:
      "ce418585988fd5824d4d947daf9f839807d165611b844e16f8a8054b760bcc1e",
  },
  {
    templateKey: "character-reference",
    version: "character-reference-v2",
    sourceHash:
      "893859100fddfe6cdaa9e01b35d23fe34e3e63e36a96ac468e8858b710d9ce1a",
  },
  {
    templateKey: "thumbnail",
    version: "thumbnail-v1",
    sourceHash:
      "4058fbb108a90e0ba4f7b5742140c4f7e70621545059ee31fd73aeda499fdda8",
  },
];

/**
 * The versions this build produces, taken from the prompt package itself so a
 * bump cannot be forgotten here.
 */
const CURRENT_PROMPT_TEMPLATES: readonly KnownPromptTemplate[] = [
  {
    templateKey: "scene-image",
    version: SCENE_IMAGE_PROMPT_VERSION,
    sourceHash: SCENE_IMAGE_PROMPT_TEMPLATE_SOURCE_HASH,
  },
  {
    templateKey: "scene-outpaint",
    version: SCENE_OUTPAINT_PROMPT_VERSION,
    sourceHash: SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH,
  },
  {
    templateKey: "character-reference",
    version: CHARACTER_REFERENCE_PROMPT_VERSION,
    sourceHash: CHARACTER_REFERENCE_PROMPT_TEMPLATE_SOURCE_HASH,
  },
  {
    templateKey: "thumbnail",
    version: THUMBNAIL_PROMPT_VERSION,
    sourceHash: THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
  },
];

export const KNOWN_PROMPT_TEMPLATES: readonly KnownPromptTemplate[] = [
  ...RETIRED_PROMPT_TEMPLATES,
  ...CURRENT_PROMPT_TEMPLATES,
];

export function findKnownPromptTemplate(
  templateKey: PromptTemplateKey,
  version: string,
): KnownPromptTemplate | null {
  return (
    KNOWN_PROMPT_TEMPLATES.find(
      (template) =>
        template.templateKey === templateKey && template.version === version,
    ) ?? null
  );
}

export type PromptTemplateVerification =
  /** The template is published, unaltered, and this build understands it. */
  | { outcome: "verified" }
  /**
   * This build has never heard of the version. It is evidence that the worker
   * is older than the website, not evidence of anything wrong, so the job is
   * worth holding rather than killing.
   */
  | { outcome: "unknownVersion"; version: string }
  /** Something genuinely does not line up. The job must not proceed. */
  | { outcome: "mismatch"; reason: string };

/**
 * Decides whether a job's cited prompt template can be trusted.
 *
 * Ordered so that a real inconsistency is always reported as a mismatch, and
 * only a job that is otherwise entirely consistent can come back as merely
 * unknown. An unknown version is the lenient answer, so nothing suspicious is
 * allowed to reach it.
 */
export function verifyPromptTemplate(input: {
  templateKey: PromptTemplateKey;
  /** The version recorded on the generation when it was created. */
  pinnedVersion: string | null;
  /** The template row id recorded on the generation. */
  pinnedVersionId: string | null;
  /** The template row as it stands in the database now. */
  storedTemplate: {
    id: string;
    version: string;
    sourceHash: string;
  } | null;
}): PromptTemplateVerification {
  if (!input.pinnedVersion || !input.pinnedVersionId)
    return {
      outcome: "mismatch",
      reason: "the generation does not name a prompt template",
    };
  if (!input.storedTemplate)
    return {
      outcome: "mismatch",
      reason: "the prompt template it names no longer exists",
    };
  if (input.storedTemplate.id !== input.pinnedVersionId)
    return {
      outcome: "mismatch",
      reason: "the prompt template row does not match the one it was pinned to",
    };
  if (input.storedTemplate.version !== input.pinnedVersion)
    return {
      outcome: "mismatch",
      reason: "the prompt template version was changed after it was pinned",
    };

  const known = findKnownPromptTemplate(input.templateKey, input.pinnedVersion);
  if (!known)
    return { outcome: "unknownVersion", version: input.pinnedVersion };

  if (known.sourceHash !== input.storedTemplate.sourceHash)
    return {
      outcome: "mismatch",
      reason: "the prompt template source does not match its published hash",
    };

  return { outcome: "verified" };
}
