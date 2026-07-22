import type { Metadata } from "next";
import { PrivacyPolicyPage } from "@/components/legal/PrivacyPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy | VCStudio",
  description:
    "Learn how VCStudio collects, uses, stores, and protects personal information and connected social platform data.",
  alternates: {
    canonical: "https://vcstudio.veilcode.studio/privacy",
  },
};

export default function PrivacyPage() {
  return <PrivacyPolicyPage />;
}
