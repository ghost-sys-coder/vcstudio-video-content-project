import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SceneCameraControls({
  shot,
  angle,
  motion,
  disabled,
  idPrefix,
}: {
  shot: string;
  angle: string;
  motion: string;
  disabled: boolean;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {[
        ["cameraShot", "Shot", shot],
        ["cameraAngle", "Angle", angle],
        ["cameraMotion", "Motion", motion],
      ].map(([name, label, value]) => (
        <div className="space-y-2" key={name}>
          <Label htmlFor={`${idPrefix}-${name}`}>{label}</Label>
          <Input
            defaultValue={value}
            disabled={disabled}
            id={`${idPrefix}-${name}`}
            name={name}
            required
          />
        </div>
      ))}
    </div>
  );
}
