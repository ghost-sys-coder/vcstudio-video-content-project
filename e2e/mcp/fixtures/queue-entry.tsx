import { createRoot } from "react-dom/client";
import { ProductionQueueHarness } from "./ProductionQueueHarness";

const root = document.getElementById("root");
if (root) createRoot(root).render(<ProductionQueueHarness />);
