import { createRoot } from "react-dom/client";
import { VideoMediaHarness } from "./VideoMediaHarness";
const root = document.getElementById("root");
if (root) createRoot(root).render(<VideoMediaHarness />);
