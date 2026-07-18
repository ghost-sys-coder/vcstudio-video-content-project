import { notFound } from "next/navigation";
import { AudioWorkspace } from "@/components/audio/AudioWorkspace";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadAudioWorkspace } from "@/lib/audio/audio-workspace-details";
import { can } from "@/lib/policies/workspace-policy";

export default async function ProjectAudioPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const workspaceId = context.activeMembership.workspaceId;
  const project = await findProject({ workspaceId, projectId });
  if (!project) notFound();

  const audio = await loadAudioWorkspace({ workspaceId, project });
  const notArchived = project.status !== "archived";
  const role = context.activeMembership.role;

  return (
    <AudioWorkspace
      canGenerate={can(role, "generateSceneAudio") && notArchived}
      canManageVoicePresets={can(role, "manageVoicePresets") && notArchived}
      canReview={can(role, "reviewSceneAudio") && notArchived}
      initialData={audio}
      projectId={project.id}
    />
  );
}
