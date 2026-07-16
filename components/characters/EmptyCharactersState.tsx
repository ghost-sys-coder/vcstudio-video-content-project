import { UsersIcon } from "lucide-react";

export function EmptyCharactersState() {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <UsersIcon className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 font-semibold">No characters yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create a character to establish consistent identity references across
        scenes.
      </p>
    </div>
  );
}
