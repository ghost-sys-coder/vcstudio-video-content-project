import { notFound } from "next/navigation";
import { ProjectHeader } from "@/components/projects/ProjectHeader";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) notFound();
  return <ProjectHeader project={project}>{children}</ProjectHeader>;
}
