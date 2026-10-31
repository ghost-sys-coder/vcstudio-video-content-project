import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import type {
  SceneNavigationRow,
  SceneStatusFilter,
} from "@/lib/scenes/scene-navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SceneNavigatorItem } from "@/components/scenes/SceneNavigatorItem";

const statusOptions: Array<{ value: SceneStatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "generating", label: "Generating" },
  { value: "generated", label: "Generated" },
  { value: "revisionRequired", label: "Revision required" },
  { value: "locked", label: "Locked" },
];

export function SceneNavigator({
  rows,
  selectedSceneId,
  query,
  status,
  totalCount,
  approvedCount,
  onQueryChange,
  onStatusChange,
  onSelect,
}: {
  rows: SceneNavigationRow[];
  selectedSceneId: string | null;
  query: string;
  status: SceneStatusFilter;
  totalCount: number;
  approvedCount: number;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: SceneStatusFilter) => void;
  onSelect: (sceneId: string) => void;
}) {
  return (
    <aside
      aria-label="Scene navigator"
      className="overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-2rem)] lg:flex-col"
    >
      <div className="space-y-4 border-b p-4">
        <div>
          <h2 className="font-semibold">Scenes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {approvedCount} of {totalCount} approved
          </p>
        </div>
        <div className="space-y-2">
          <Label className="sr-only" htmlFor="scene-search">
            Search scenes
          </Label>
          <Input
            id="scene-search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search scenes…"
            type="search"
            value={query}
          />
          <Label className="sr-only" htmlFor="scene-status-filter">
            Filter scenes by status
          </Label>
          <FormSelect
            id="scene-status-filter"
            onValueChange={(selectedValue) => {
              const selectedStatus = statusOptions.find(
                (option) => option.value === selectedValue,
              );
              onStatusChange(selectedStatus?.value ?? "all");
            }}
            value={status}
          >
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </FormSelect>
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          Showing {rows.length} of {totalCount}
        </p>
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
        {rows.length ? (
          rows.map((row) => (
            <SceneNavigatorItem
              key={row.scene.id}
              onSelect={() => onSelect(row.scene.id)}
              row={row}
              selected={row.scene.id === selectedSceneId}
            />
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No scenes match this search and filter.
          </p>
        )}
      </div>
    </aside>
  );
}
