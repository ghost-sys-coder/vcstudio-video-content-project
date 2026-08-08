import type { SocialPostStatus, SocialPostTargetStatus } from "@/db/schema";

export type MarketingCalendarPlatform = {
  label: string;
  accountName: string;
  status: SocialPostTargetStatus;
};

export type MarketingCalendarEntry =
  | {
      kind: "social_post";
      id: string;
      title: string;
      status: SocialPostStatus;
      occursAt: string;
      mediaPreviewUrl: string | null;
      mediaKind: "image" | "video" | null;
      platforms: MarketingCalendarPlatform[];
    }
  | {
      kind: "marketing_intent";
      id: string;
      title: string;
      status: "intent";
      occursAt: string;
      mediaPreviewUrl: null;
      mediaKind: null;
      platforms: [];
    };

export type MarketingCalendarDay = {
  key: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  entries: MarketingCalendarEntry[];
};

function localDateKey(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function buildMarketingCalendarMonth(input: {
  year: number;
  month: number;
  entries: MarketingCalendarEntry[];
  today?: Date;
}): MarketingCalendarDay[] {
  const first = new Date(input.year, input.month, 1);
  const start = new Date(input.year, input.month, 1 - first.getDay());
  const todayKey = localDateKey(input.today ?? new Date());
  const byDate = new Map<string, MarketingCalendarEntry[]>();
  for (const entry of input.entries) {
    const key = localDateKey(new Date(entry.occursAt));
    const current = byDate.get(key);
    if (current) current.push(entry);
    else byDate.set(key, [entry]);
  }

  return Array.from({ length: 42 }, (_, offset) => {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = localDateKey(date);
    return {
      key,
      dayNumber: date.getDate(),
      inCurrentMonth: date.getMonth() === input.month,
      isToday: key === todayKey,
      entries: [...(byDate.get(key) ?? [])].sort((left, right) =>
        left.occursAt.localeCompare(right.occursAt),
      ),
    };
  });
}
