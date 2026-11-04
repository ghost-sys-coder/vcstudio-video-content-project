import { createRoot } from "react-dom/client";
import { McpReviewWidget } from "@/components/mcp/McpReviewWidget";
const root = document.getElementById("root");
if (root) createRoot(root).render(<McpReviewWidget />);
