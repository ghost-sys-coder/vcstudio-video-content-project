import type { ButtonHTMLAttributes } from "react";
import { Button } from "@/components/ui/button";

export function AnalyzeScriptButton(
  props: ButtonHTMLAttributes<HTMLButtonElement>,
) {
  return (
    <Button {...props} type="button">
      Analyze approved script
    </Button>
  );
}
