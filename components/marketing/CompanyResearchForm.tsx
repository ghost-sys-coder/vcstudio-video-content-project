import { requestCompanyResearchAction } from "@/app/(authenticated)/app/marketing/research/actions";
import { Button } from "@/components/ui/button";

export function CompanyResearchForm({
  businessName,
}: {
  businessName: string;
}) {
  return (
    <form
      action={requestCompanyResearchAction}
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_auto] sm:items-end"
    >
      <label className="grid gap-1 text-sm font-medium">
        Company research focus
        <input
          className="h-10 rounded-lg border bg-background px-3 font-normal"
          defaultValue={`Research ${businessName || "our company"}'s current market, customer needs, industry developments, and timely content opportunities.`}
          maxLength={500}
          name="topic"
          required
        />
      </label>
      <Button type="submit">Research company</Button>
    </form>
  );
}
