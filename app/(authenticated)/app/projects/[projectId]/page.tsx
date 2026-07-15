import { redirect } from "next/navigation";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  redirect(`/app/projects/${(await params).projectId}/script`);
}
