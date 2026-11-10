import { createRoot } from "react-dom/client";
import { McpGenerationReviewWidget } from "@/components/mcp/McpGenerationReviewWidget";
const root = document.getElementById("root");
if (root) createRoot(root).render(<McpGenerationReviewWidget />);
