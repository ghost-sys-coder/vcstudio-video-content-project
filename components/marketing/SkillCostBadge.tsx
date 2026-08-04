import { Badge } from "@/components/ui/badge";
export function SkillCostBadge({
  range,
}: {
  range: readonly [number, number];
}) {
  return (
    <Badge variant="outline">
      {range[1] === 0
        ? "Free"
        : `Est. $${(range[0] / 100).toFixed(2)}–$${(range[1] / 100).toFixed(2)}`}
    </Badge>
  );
}
