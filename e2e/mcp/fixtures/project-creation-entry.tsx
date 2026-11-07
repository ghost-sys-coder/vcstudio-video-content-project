import { createRoot } from "react-dom/client";
import { ProjectCreationHarness } from "./ProjectCreationHarness";
document.documentElement.classList.toggle(
  "dark",
  new URLSearchParams(location.search).get("theme") === "dark",
);
createRoot(document.getElementById("root")!).render(<ProjectCreationHarness />);
