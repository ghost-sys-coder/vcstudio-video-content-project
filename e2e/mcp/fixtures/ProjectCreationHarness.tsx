import { CreateProjectForm } from "@/components/projects/CreateProjectForm";

export function ProjectCreationHarness() {
  return (
    <main className="app-page app-form-page">
      <CreateProjectForm
        defaultBudgetCents={0}
        formats={[]}
        ideaGroups={[]}
        styles={[]}
      />
    </main>
  );
}
