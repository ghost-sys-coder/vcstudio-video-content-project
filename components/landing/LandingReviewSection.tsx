import {
  CheckCircle2Icon,
  HistoryIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import { LandingReviewMockupCard } from "@/components/landing/LandingReviewMockupCard";
import { LandingReviewPoint } from "@/components/landing/LandingReviewPoint";
import { LandingSectionHeading } from "@/components/landing/LandingSectionHeading";

const REVIEW_POINTS: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: WalletIcon,
    title: "Reserved before it runs",
    description:
      "Estimated cost is set aside before any provider call, then reconciled to the exact amount.",
  },
  {
    icon: CheckCircle2Icon,
    title: "Approve or send back",
    description:
      "Every scene, image, audio clip, and subtitle track waits for an explicit approval.",
  },
  {
    icon: HistoryIcon,
    title: "A timestamped record",
    description:
      "Who approved, cancelled, or regenerated what is logged, not remembered.",
  },
];

export function LandingReviewSection() {
  return (
    <section className="border-b py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <LandingSectionHeading
          description="A finished generation is not the same as an approved one. Review sits between them at every stage."
          eyebrow="Nothing ships without a look"
          title="Every generated asset waits for a human decision."
        />
        <LandingReviewMockupCard />
        <div className="mx-auto mt-14 grid max-w-4xl gap-8 sm:grid-cols-3">
          {REVIEW_POINTS.map((point) => (
            <LandingReviewPoint
              description={point.description}
              icon={point.icon}
              key={point.title}
              title={point.title}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
