import { createRoot } from "react-dom/client";
import { MediaUploadHarness } from "./MediaUploadHarness";
document.documentElement.classList.toggle(
  "dark",
  new URLSearchParams(location.search).get("theme") === "dark",
);
const root = document.getElementById("root");
if (root) createRoot(root).render(<MediaUploadHarness />);
