import { cn } from "@/lib/utils";

export function StoryboardSelectionCheckbox({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium select-none",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <input
        aria-label={label}
        checked={checked}
        className="size-4 rounded border-foreground/30 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}
