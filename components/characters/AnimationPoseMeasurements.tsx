import {
  ANIMATION_POSE_LABELS,
  type AnimationPoseDiagnostic,
} from "@/lib/characters/animation-check-view";

function transparency(pose: AnimationPoseDiagnostic): string {
  if (!pose.present) return "—";
  if (!pose.hasAlphaChannel) return "no alpha";
  return `${(pose.transparentShareBps / 100).toFixed(1)}%`;
}

function dimensions(pose: AnimationPoseDiagnostic): string {
  if (!pose.present || !pose.width || !pose.height) return "—";
  return `${pose.width}×${pose.height}`;
}

/**
 * What was measured in each stored pose still, so a failing check can be traced
 * to the specific image that caused it.
 */
export function AnimationPoseMeasurements({
  poses,
}: {
  poses: AnimationPoseDiagnostic[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Measured properties of each stored pose still
        </caption>
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium" scope="col">
              Pose
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              Stored
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              Size
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              Format
            </th>
            <th className="px-3 py-2 font-medium" scope="col">
              Transparent
            </th>
          </tr>
        </thead>
        <tbody>
          {poses.map((pose) => (
            <tr className="border-b last:border-b-0" key={pose.pose}>
              <th className="px-3 py-2 font-normal" scope="row">
                {ANIMATION_POSE_LABELS[pose.pose]}
              </th>
              <td className="px-3 py-2 text-muted-foreground">
                {pose.present ? "Yes" : "Not generated"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {dimensions(pose)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {pose.contentType ?? "—"}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {transparency(pose)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
