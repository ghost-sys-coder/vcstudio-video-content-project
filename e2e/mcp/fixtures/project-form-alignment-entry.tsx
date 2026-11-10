import { createRoot } from "react-dom/client";
import { ProjectFormAlignmentHarness } from "./ProjectFormAlignmentHarness";

document.documentElement.classList.toggle(
  "dark",
  new URLSearchParams(location.search).get("theme") === "dark",
);
createRoot(document.getElementById("root")!).render(
  <ProjectFormAlignmentHarness />,
);
