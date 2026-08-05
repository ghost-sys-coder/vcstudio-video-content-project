import { MarketingHome } from "@/components/marketing/MarketingHome";
import { countKnowledgeDocuments } from "@/db/repositories/marketing-documents.repository";
import { findMarketingSettings } from "@/db/repositories/marketing-settings.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { AUTONOMY_LEVEL_LABELS } from "@/lib/marketing/autonomy-labels";
import { loadBrandWorkspaceView } from "@/lib/marketing/brand/brand-view";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";
import { selectMarketingSetupSteps } from "@/lib/marketing/marketing-setup-steps";
import { listMarketingScheduleRules } from "@/db/repositories/marketing-schedules.repository";

export default async function MarketingHomePage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const { workspaceId } = context.activeMembership;
  const [settings, stored, brand, documentCount, scheduleRules] =
    await Promise.all([
      loadMarketingSettings({ workspaceId }),
      findMarketingSettings({ workspaceId }),
      loadBrandWorkspaceView({ workspaceId }),
      countKnowledgeDocuments({ workspaceId }),
      listMarketingScheduleRules({ workspaceId }),
    ]);

  return (
    <MarketingHome
      autonomyLabel={AUTONOMY_LEVEL_LABELS[settings.autonomyLevel]}
      steps={selectMarketingSetupSteps({
        hasSavedSettings: stored !== null,
        brandComplete: brand.profile.onboardingStatus === "complete",
        brandRequiredRemaining: brand.completeness.requiredRemaining,
        documentCount,
        scheduleRuleCount: scheduleRules.length,
      })}
    />
  );
}
