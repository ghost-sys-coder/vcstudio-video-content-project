/**
 * Derive up to two uppercase initials for a user avatar: first + last name
 * initial when a full name is available, the first two letters of a single
 * name, an email fallback, otherwise a neutral placeholder.
 */
export function getUserInitials(displayName: string, email?: string): string {
  const name = displayName.trim();
  if (name) {
    const parts = name.split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  const local = (email ?? "").trim();
  if (local) return local.slice(0, 2).toUpperCase();
  return "?";
}
