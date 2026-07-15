import { UserButton } from "@clerk/nextjs";

export function UserAccountMenu({ displayName }: { displayName: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-muted-foreground md:inline">
        {displayName}
      </span>
      <UserButton />
    </div>
  );
}
