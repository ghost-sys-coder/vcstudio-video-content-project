import type { CharacterReferenceType } from "@/db/schema";
import type { CharacterStatus } from "@/db/schema";

export const singleCharacterReferenceTypes = new Set<CharacterReferenceType>([
  "master",
  "front",
  "threeQuarter",
  "side",
  "fullBody",
]);

export function createCharacterSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "character"
  );
}

export function isCharacterMutable(status: CharacterStatus): boolean {
  return status !== "archived";
}

export function areReferenceDimensionsAllowed(input: {
  width: number;
  height: number;
  minimumWidth: number;
  minimumHeight: number;
  maximumWidth: number;
  maximumHeight: number;
}): boolean {
  return (
    input.width >= input.minimumWidth &&
    input.height >= input.minimumHeight &&
    input.width <= input.maximumWidth &&
    input.height <= input.maximumHeight
  );
}
