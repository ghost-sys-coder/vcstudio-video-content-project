"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/db/schema";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProjectHeader({
  children,
  project,
}: {
  children: React.ReactNode;
  project: Project;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = pathname.endsWith("/settings") ? "settings" : "script";

  return (
    <Tabs
      onValueChange={(value) =>
        router.push(`/app/projects/${project.id}/${String(value)}`)
      }
      value={activeTab}
    >
      <header className="mb-6 border-b pb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
        </div>
        <TabsList className="mt-5" variant="line">
          <TabsTrigger value="script">Script</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </header>
      <TabsContent value={activeTab}>{children}</TabsContent>
    </Tabs>
  );
}
