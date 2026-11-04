import { createRoot } from "react-dom/client";
import { OperationsUiHarness } from "./OperationsUiHarness";
const root = document.getElementById("root");
if (root) createRoot(root).render(<OperationsUiHarness />);
