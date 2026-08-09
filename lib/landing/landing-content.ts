import {
  AudioLinesIcon,
  CaptionsIcon,
  CheckCircle2Icon,
  FileTextIcon,
  FilmIcon,
  HistoryIcon,
  ImageIcon,
  LayersIcon,
  MegaphoneIcon,
  Mic2Icon,
  RadioTowerIcon,
  SearchIcon,
  ShieldCheckIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

export type ProductArea = {
  index: string;
  title: string;
  description: string;
  capabilities: readonly string[];
  icon: LucideIcon;
  emphasis: "primary" | "secondary";
};

export const PRODUCT_AREAS: ProductArea[] = [
  {
    index: "01",
    title: "Marketing Studio",
    description:
      "Ground AI in your brand, turn research into campaigns, and move every draft through a visible content queue before it reaches the calendar.",
    capabilities: [
      "Brand profiles and knowledge documents",
      "AI chat with purpose-built marketing skills",
      "Campaigns, cited research, schedules, and approvals",
    ],
    icon: MegaphoneIcon,
    emphasis: "primary",
  },
  {
    index: "02",
    title: "Cross-platform publishing",
    description:
      "Write once, tailor captions per destination, attach private media, and publish now or schedule through one durable delivery path.",
    capabilities: [
      "LinkedIn, X, Facebook, Instagram, TikTok, and YouTube",
      "Connected-account health and provider readiness",
      "Independent outcomes for every destination",
    ],
    icon: RadioTowerIcon,
    emphasis: "secondary",
  },
  {
    index: "03",
    title: "Video production",
    description:
      "Take a brief from script to scenes, storyboard, narration, subtitles, reusable aspect ratios, and deterministic Remotion exports.",
    capabilities: [
      "Still-image and animated-character projects",
      "Landscape, vertical, square, and Shorts outputs",
      "Reviewable, versioned assets at every stage",
    ],
    icon: FilmIcon,
    emphasis: "secondary",
  },
  {
    index: "04",
    title: "Characters and voices",
    description:
      "Keep recurring characters recognizable across scenes and give approved self-voices a secure path into scene-level narration.",
    capabilities: [
      "Reference-anchored character continuity",
      "Talking, blinking character animation",
      "Verified custom voices and manual recordings",
    ],
    icon: Mic2Icon,
    emphasis: "primary",
  },
];

export type WorkflowStep = {
  index: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    index: "01",
    title: "Write or generate a script",
    description:
      "Paste a finished narration script, or draft one from a short brief — topic, audience, tone, and target length.",
    icon: FileTextIcon,
  },
  {
    index: "02",
    title: "Break it into scenes",
    description:
      "An approved script is analyzed into structured, editable scenes ready for visual direction.",
    icon: LayersIcon,
  },
  {
    index: "03",
    title: "Build the storyboard",
    description:
      "Reference-locked character profiles keep every generated scene image consistent, reviewed and approved one scene or one batch at a time.",
    icon: ImageIcon,
  },
  {
    index: "04",
    title: "Produce narration audio",
    description:
      "Per-scene text-to-speech with workspace voice presets and measured durations feed a drift-free project timeline.",
    icon: AudioLinesIcon,
  },
  {
    index: "05",
    title: "Generate subtitles",
    description:
      "Captions are segmented from the timeline and exported as SRT, WebVTT, or burned-in Remotion text.",
    icon: CaptionsIcon,
  },
  {
    index: "06",
    title: "Render the final video",
    description:
      "A deterministic Remotion render, gated by the same cost and approval checks as every step before it.",
    icon: FilmIcon,
  },
];

export type FeatureHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  {
    title: "Reserve-before-spend cost control",
    description:
      "Every billable call reserves an estimated cost, runs, then reconciles to the actual amount — checked against workspace daily, monthly, and per-project limits before it can spend anything.",
    icon: WalletIcon,
  },
  {
    title: "Approval before distribution",
    description:
      "Marketing drafts, scenes, images, audio, and subtitles carry explicit review states. A generation being finished is not the same as it being ready to publish.",
    icon: CheckCircle2Icon,
  },
  {
    title: "Grounded creation",
    description:
      "Brand knowledge grounds marketing output while reference-locked character profiles keep faces, wardrobe, and style consistent across video scenes.",
    icon: SearchIcon,
  },
  {
    title: "Role-based workspaces",
    description:
      "Owner, editor, and viewer permissions are enforced on the server for every workspace-owned record — never trusted from the browser.",
    icon: ShieldCheckIcon,
  },
  {
    title: "Full audit trail",
    description:
      "Destructive and billable actions are recorded with who did what and when, so review history is a fact, not a memory.",
    icon: HistoryIcon,
  },
  {
    title: "Production through publishing",
    description:
      "Frame-accurate Remotion exports flow into connected-platform publishing with durable status, scheduling, and destination-level outcomes.",
    icon: RadioTowerIcon,
  },
];
