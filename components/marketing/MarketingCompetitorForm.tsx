import { createMarketingCompetitorAction } from "@/app/(authenticated)/app/marketing/research/actions";
import { Button } from "@/components/ui/button";

export function MarketingCompetitorForm() {
  return (
    <form
      action={createMarketingCompetitorAction}
      className="grid gap-3 rounded-xl border p-4 lg:grid-cols-2"
    >
      <label className="grid gap-1 text-sm font-medium">
        Competitor name
        <input
          className="h-10 rounded-lg border bg-background px-3"
          name="name"
          placeholder="e.g. Acme Studio"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Website
        <input
          className="h-10 rounded-lg border bg-background px-3"
          name="websiteUrl"
          placeholder="https://competitor.example"
          type="url"
        />
      </label>
      <label className="grid gap-1 text-sm font-medium lg:col-span-2">
        Research notes
        <textarea
          className="min-h-24 rounded-lg border bg-background p-3"
          defaultValue="Track their positioning, offers, content themes, product announcements, and gaps our campaign can address without copying their work."
          name="notes"
        />
      </label>
      <Button className="w-fit" type="submit">
        Add competitor
      </Button>
    </form>
  );
}
