import { createRoot } from "react-dom/client";
import { VideoStudioHarness } from "./VideoStudioHarness";
const root = document.getElementById("root");
if (root) createRoot(root).render(<VideoStudioHarness />);
