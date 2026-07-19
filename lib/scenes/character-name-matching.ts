import { createCharacterSlug } from "@/lib/domain/character";

/**
 * A project-cast member that a free-text scene character name can be matched
 * against. `name` is the canonical character name; matching is done purely on a
 * normalized form of it, never on stored identifiers supplied by the browser.
 */
export type CastMatchCandidate = {
  id: string;
  name: string;
};

const LEADING_ARTICLE = /^(the|a|an)\s+/i;

/**
 * De-pluralize the final token of a slug conservatively so "detectives" and
 * "detective" collapse to the same canonical form. Intentionally simple and
 * predictable — it never touches `ss` endings and leaves short tokens alone.
 */
function depluralizeSlugToken(slug: string): string {
  const parts = slug.split("-");
  const lastIndex = parts.length - 1;
  const last = parts[lastIndex];
  if (!last || last.length <= 3) return slug;
  if (last.endsWith("ies") && last.length > 4) {
    parts[lastIndex] = `${last.slice(0, -3)}y`;
  } else if (last.endsWith("ss")) {
    return slug;
  } else if (last.endsWith("s")) {
    parts[lastIndex] = last.slice(0, -1);
  }
  return parts.join("-");
}

/**
 * Canonicalize a character name for matching: drop a leading article, slugify
 * with the same rules used to build character slugs, then de-pluralize. Returns
 * an empty string for names that carry no matchable content.
 */
export function normalizeCharacterName(value: string): string {
  const withoutArticle = value.trim().replace(LEADING_ARTICLE, "");
  const slug = createCharacterSlug(withoutArticle);
  if (slug === "character" && withoutArticle.trim() === "") return "";
  return depluralizeSlugToken(slug);
}

/**
 * Match the free-text character names extracted by scene analysis against a
 * project's cast, returning the ids of cast members named in `names`. Order
 * follows the cast; each id appears at most once. Matching only ever suggests a
 * character for assignment — it never edits or renames a character.
 */
export function matchCharacterNamesToCast(
  names: readonly string[],
  cast: readonly CastMatchCandidate[],
): string[] {
  const normalizedNames = new Set(
    names.map(normalizeCharacterName).filter((value) => value !== ""),
  );
  const matched: string[] = [];
  for (const member of cast) {
    const normalized = normalizeCharacterName(member.name);
    if (normalized !== "" && normalizedNames.has(normalized)) {
      matched.push(member.id);
    }
  }
  return matched;
}
