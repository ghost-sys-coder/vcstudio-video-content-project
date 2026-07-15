export function WorkspaceLogoImage({
  logoUrl,
  name,
  size = "default",
}: {
  logoUrl: string | null;
  name: string;
  size?: "default" | "large";
}) {
  const dimensions = size === "large" ? "size-24 text-2xl" : "size-8 text-xs";

  if (logoUrl) {
    return (
      // Signed private R2 URLs are short-lived and intentionally bypass image optimization.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${name} logo`}
        className={`${dimensions} rounded-lg border bg-background object-contain p-1`}
        src={logoUrl}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${dimensions} flex shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
