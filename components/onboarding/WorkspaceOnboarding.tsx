import { WorkspaceOnboardingForm } from "@/components/onboarding/WorkspaceOnboardingForm";

export function WorkspaceOnboarding({ displayName }: { displayName: string }) {
  return (
    <main className="app-standalone bg-muted/30">
      <section className="app-panel w-full max-w-xl rounded-2xl border bg-background shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Workspace setup
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="mt-3 max-w-lg leading-7 text-muted-foreground">
          Create the workspace that will own your projects, media, budgets, and
          production history. You will begin as its owner.
        </p>
        <WorkspaceOnboardingForm />
      </section>
    </main>
  );
}
