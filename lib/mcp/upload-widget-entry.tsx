import { createRoot } from "react-dom/client";
import { McpUploadWidget } from "@/components/mcp/McpUploadWidget";
const root = document.getElementById("root");
if (root) createRoot(root).render(<McpUploadWidget />);
