import Link from "next/link";
import { ImageIcon } from "lucide-react";
import type { CharacterListItem } from "@/db/repositories/characters.repository";
import { CharacterStatusBadge } from "@/components/characters/CharacterStatusBadge";
import { formatShortDate } from "@/lib/format/date";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function CharacterCard({ character }: { character: CharacterListItem }) {
  const summary =
    character.description ||
    character.visualIdentity ||
    "No description added yet.";

  return (
    <Link
      className="group flex h-full flex-col rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-foreground/20"
      href={`/app/characters/${character.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-sm font-semibold text-muted-foreground ring-1 ring-inset ring-foreground/10"
          >
            {getInitials(character.name)}
          </span>
          <h2 className="truncate font-semibold group-hover:underline">
            {character.name}
          </h2>
        </div>
        <CharacterStatusBadge status={character.status} />
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 flex-1 text-sm text-muted-foreground">
        {summary}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <ImageIcon aria-hidden className="size-3.5" />
          {character.referenceCount}{" "}
          {character.referenceCount === 1 ? "reference" : "references"}
        </span>
        <span>Updated {formatShortDate(character.updatedAt)}</span>
      </div>
    </Link>
  );
}
