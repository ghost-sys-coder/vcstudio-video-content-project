import { FormSelect } from "@/components/ui/FormSelect";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";

export function ProjectVisualMediaSelect() {
  return (
    <div className="space-y-2">
      <Label htmlFor="project-visual-media">Default scene visuals</Label>
      <FormSelect
        id="project-visual-media"
        name="defaultVisualMedia"
        defaultValue="image"
      >
        <SelectItem value="image">Still images</SelectItem>
        <SelectItem value="video">Video footage</SelectItem>
      </FormSelect>
      <p className="text-xs text-muted-foreground">
        Scenes inherit this choice and can use either images or video. Reuse
        uploaded footage or generate clips when available. Creating a project
        starts no generation.
      </p>
    </div>
  );
}
