export function ImageGenerationErrorState({
  safeErrorMessage,
  generationVersion,
  reservationReleased,
}: {
  safeErrorMessage: string | null;
  generationVersion: number;
  reservationReleased: boolean;
}) {
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      role="alert"
    >
      <h3 className="font-medium text-destructive">
        Generation v{generationVersion} failed
      </h3>
      <p className="mt-1 text-sm">
        {safeErrorMessage ?? "The image could not be generated."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {reservationReleased
          ? "The unused reservation was released. Generate again only when you are ready to create a new paid version."
          : "Usage reconciliation is still pending. Refresh before starting another paid generation."}
      </p>
    </div>
  );
}
