import { LandingProductPanel } from "@/components/landing/LandingProductPanel";
import { PRODUCT_AREAS } from "@/lib/landing/landing-content";

export function LandingProductSection() {
  return (
    <section className="border-b py-24 sm:py-28" id="studio">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
              One content operating system
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.04] tracking-[-0.045em] text-balance sm:text-5xl">
              Plan the work, make the assets, and publish from one reviewed
              record.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-pretty text-muted-foreground lg:col-span-5">
            VCStudio connects the work that usually falls between separate
            tools: brand context, campaign planning, social delivery, video
            production, reusable characters, and narration voices.
          </p>
        </div>
        <div className="mt-14 grid gap-5 lg:grid-cols-12">
          {PRODUCT_AREAS.map((area) => (
            <LandingProductPanel area={area} key={area.title} />
          ))}
        </div>
      </div>
    </section>
  );
}
