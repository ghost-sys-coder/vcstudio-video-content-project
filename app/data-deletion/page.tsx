import type { Metadata } from "next";
import { DataDeletionPage } from "@/components/legal/DataDeletionPage";

export const metadata: Metadata = {
  title: "Data Deletion Instructions | VCStudio",
  description:
    "Learn how to disconnect social accounts and request deletion of VCStudio data.",
  alternates: {
    canonical: "https://vcstudio.veilcode.studio/data-deletion",
  },
};

export default function DataDeletionInstructionsPage() {
  return <DataDeletionPage />;
}
