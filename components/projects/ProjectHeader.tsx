"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Project } from "@/db/schema";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PROJECT_OVERVIEW_TAB,
  projectTabHref,
  resolveProjectTab,
} from "@/lib/production/project-tab";

export function ProjectHeader({
  children,
  project,
}: {
  children: React.ReactNode;
  project: Project;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activeTab = resolveProjectTab(pathname);

  return (
    <Tabs
      className="min-w-0 max-w-full"
      onValueChange={(value) =>
        router.push(projectTabHref(project.id, String(value)))
      }
      value={activeTab}
    >
      <header className="mb-6 min-w-0 max-w-full border-b pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="min-w-0 truncate text-2xl font-semibold">
            {project.name}
          </h1>
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="mt-5 max-w-full overflow-x-auto pb-1">
          <TabsList variant="line">
            <TabsTrigger value={PROJECT_OVERVIEW_TAB}>Overview</TabsTrigger>
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
            <TabsTrigger value="storyboard">Storyboard</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="subtitles">Subtitles</TabsTrigger>
            <TabsTrigger value="render">Render</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
        </div>
      </header>
      <TabsContent className="min-w-0 max-w-full" value={activeTab}>
        {children}
      </TabsContent>
    </Tabs>
  );
}
