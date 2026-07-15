import { Button } from "@/components/ui/button";

export function AnalyzeScriptButton({ disabled }: { disabled: boolean }) {
  return (
    <Button disabled={disabled} type="submit">
      Analyze approved script
    </Button>
  );
}
