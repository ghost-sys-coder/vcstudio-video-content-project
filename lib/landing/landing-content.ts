import {
  AudioLinesIcon,
  CaptionsIcon,
  CheckCircle2Icon,
  FileTextIcon,
  FilmIcon,
  HistoryIcon,
  ImageIcon,
  LayersIcon,
  ShieldCheckIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

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
    title: "Nothing ships without approval",
    description:
      "Scenes, images, audio, and subtitles each carry an explicit human review step. A generation being finished is not the same as it being approved.",
    icon: CheckCircle2Icon,
  },
  {
    title: "Character continuity",
    description:
      "Reference-locked character profiles keep faces, wardrobe, and style consistent across every scene an image is generated for.",
    icon: UsersIcon,
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
    title: "Deterministic renders",
    description:
      "Frame-accurate timelines render through Remotion without cumulative drift, so a preview and a final export always agree.",
    icon: FilmIcon,
  },
];
