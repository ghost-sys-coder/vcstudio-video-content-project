"use client";

import { FilmIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatUsdCents } from "@/lib/format/currency";

export function StartRenderButton({
  estimatedCostCents,
  disabled,
  pending,
  onStart,
}: {
  estimatedCostCents: number;
  disabled: boolean;
  pending: boolean;
  onStart: () => void;
}) {
  return (
    <Button disabled={disabled || pending} onClick={onStart} type="button">
      <FilmIcon aria-hidden />
      {pending
        ? "Starting…"
        : `Render video · ${formatUsdCents(estimatedCostCents)}`}
    </Button>
  );
}
