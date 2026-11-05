import { createRoot } from "react-dom/client";
import { TikTokConnectHarness } from "./TikTokConnectHarness";
const root = document.getElementById("root");
if (root) createRoot(root).render(<TikTokConnectHarness />);
