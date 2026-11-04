import { WaitlistPageContent } from "@/components/auth/WaitlistPageContent";
import { LandingAccountActions } from "@/components/landing/LandingAccountActions";

export function WaitlistUiHarness() {
  return (
    <main className="app-standalone">
      <div className="w-full max-w-md app-section">
        <LandingAccountActions />
        <WaitlistPageContent />
      </div>
    </main>
  );
}
