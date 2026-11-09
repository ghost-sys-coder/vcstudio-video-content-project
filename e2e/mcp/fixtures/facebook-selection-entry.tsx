import { createRoot } from "react-dom/client";
import { FacebookSelectionHarness } from "./FacebookSelectionHarness";
const root = document.getElementById("root");
if (root) createRoot(root).render(<FacebookSelectionHarness />);
