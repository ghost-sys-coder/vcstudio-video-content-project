import { TriangleAlertIcon } from "lucide-react";

export function RenderErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}
