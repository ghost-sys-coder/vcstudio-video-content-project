import type { PublishableRenderView } from "@/lib/publishing/publishing-view";

export type PublishableRenderGroup = {
  groupLabel: string;
  renders: PublishableRenderView[];
};

/**
 * Collects renders under their group heading while preserving the view's
 * shorts → variants → full-video ordering, so a picker reads as titled sections.
 *
 * Order comes from first appearance rather than a sort, because the loader has
 * already decided the sequence and re-sorting here would silently override it.
 */
export function groupRendersByKind(
  renders: PublishableRenderView[],
): PublishableRenderGroup[] {
  const groups: PublishableRenderGroup[] = [];
  for (const render of renders) {
    const existing = groups.find(
      (group) => group.groupLabel === render.groupLabel,
    );
    if (existing) existing.renders.push(render);
    else groups.push({ groupLabel: render.groupLabel, renders: [render] });
  }
  return groups;
}
