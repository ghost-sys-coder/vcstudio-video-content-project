export function EmptyIdeasState() {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm font-medium">No saved ideas yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Generate ideas for a niche above, then save the ones worth developing.
        Saved ideas can start a project from the script screen.
      </p>
    </div>
  );
}
