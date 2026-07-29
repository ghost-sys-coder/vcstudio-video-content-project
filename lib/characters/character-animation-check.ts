import "server-only";

import type { Character, CharacterReferenceAsset } from "@/db/schema";
import { findCharacterAnimationPoseAssets } from "@/db/repositories/character-pose.repository";
import {
  buildAnimationChecks,
  canPreviewAnimation,
  isAnimationReady,
} from "@/lib/characters/animation-check-verdict";
import {
  ANIMATION_POSE_KEYS,
  type AnimationPoseDiagnostic,
  type AnimationPoseKey,
  type CharacterAnimationCheckView,
} from "@/lib/characters/animation-check-view";
import { analyzeImageAlpha } from "@/lib/media/image-alpha";
import {
  createCharacterReferenceDownloadUrl,
  downloadCharacterReferenceBytes,
} from "@/lib/storage/character-reference-storage";

/**
 * Runs the pre-flight animation check for one character.
 *
 * This exists because everything upstream of the renderer can look healthy
 * while the video still comes out wrong: the four pose stills can all be
 * generated, marked as PNG, and stored successfully, and yet be painted-in
 * frames that composite as opaque rectangles over the scene plate. The only way
 * to know is to decode what was actually stored, so this downloads each pose and
 * measures it rather than trusting the generation request.
 *
 * It is deliberately on-demand — four object reads and four decodes are too
 * much to spend on every visit to a character page.
 */
export class CharacterAnimationCheckError extends Error {
  readonly code = "CHARACTER_ANIMATION_CHECK_FAILED";

  constructor(message = "The pose images could not be inspected.") {
    super(message);
    this.name = "CharacterAnimationCheckError";
  }
}

function absentPose(pose: AnimationPoseKey): AnimationPoseDiagnostic {
  return {
    pose,
    present: false,
    contentType: null,
    width: null,
    height: null,
    hasAlphaChannel: false,
    transparentShareBps: 0,
    cornersTransparent: false,
    previewUrl: null,
  };
}

async function inspectPose(
  pose: AnimationPoseKey,
  asset: CharacterReferenceAsset | null,
): Promise<AnimationPoseDiagnostic> {
  if (!asset) return absentPose(pose);
  const [bytes, previewUrl] = await Promise.all([
    downloadCharacterReferenceBytes(asset.objectKey),
    createCharacterReferenceDownloadUrl(asset.objectKey),
  ]);
  const analysis = await analyzeImageAlpha(bytes);
  return {
    pose,
    present: true,
    contentType: asset.contentType,
    // The decoded dimensions win over the stored ones: a mismatch between the
    // two is itself a sign the row and the object have drifted apart.
    width: analysis.width || asset.width,
    height: analysis.height || asset.height,
    hasAlphaChannel: analysis.hasAlphaChannel,
    transparentShareBps: analysis.transparentShareBps,
    cornersTransparent: analysis.cornersTransparent,
    previewUrl,
  };
}

export async function loadCharacterAnimationCheck(input: {
  workspaceId: string;
  character: Character;
}): Promise<CharacterAnimationCheckView> {
  const assets = await findCharacterAnimationPoseAssets({
    workspaceId: input.workspaceId,
    characterId: input.character.id,
  });

  let poses: AnimationPoseDiagnostic[];
  try {
    poses = await Promise.all(
      ANIMATION_POSE_KEYS.map((pose) => inspectPose(pose, assets[pose])),
    );
  } catch {
    // A missing or undecodable object is a real finding, but it is not one this
    // view can express per-pose without pretending to have measured something.
    throw new CharacterAnimationCheckError();
  }

  const checks = buildAnimationChecks(poses);
  return {
    characterId: input.character.id,
    characterName: input.character.name,
    poses,
    checks,
    ready: isAnimationReady(checks),
    canPreview: canPreviewAnimation(poses),
  };
}
