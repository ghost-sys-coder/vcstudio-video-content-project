import { WORKFLOW_STEPS } from "@/lib/landing/landing-content";
import { LandingSectionHeading } from "@/components/landing/LandingSectionHeading";
import { LandingWorkflowStep } from "@/components/landing/LandingWorkflowStep";

export function LandingWorkflowSection() {
  return (
    <section className="border-b py-24" id="workflow">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <LandingSectionHeading
          description="Every step produces something you can inspect and approve before the next one runs — no stage is a black box."
          eyebrow="How it works"
          title="A script becomes a video in six reviewed steps."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW_STEPS.map((step) => (
            <LandingWorkflowStep
              description={step.description}
              icon={step.icon}
              index={step.index}
              key={step.index}
              title={step.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
