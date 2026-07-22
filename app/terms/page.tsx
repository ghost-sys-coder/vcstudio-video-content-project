import type { Metadata } from "next";
import { TermsOfServicePage } from "@/components/legal/TermsOfServicePage";

export const metadata: Metadata = {
  title: "Terms of Service | VCStudio",
  description: "Terms governing access to and use of VCStudio.",
  alternates: { canonical: "https://vcstudio.veilcode.studio/terms" },
};

export default function TermsPage() {
  return <TermsOfServicePage />;
}
