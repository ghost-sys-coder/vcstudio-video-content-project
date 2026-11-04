import { createRoot } from "react-dom/client";
import { PostComposerUiHarness } from "./PostComposerUiHarness";
document.documentElement.classList.toggle(
  "dark",
  new URLSearchParams(location.search).get("theme") === "dark",
);
createRoot(document.getElementById("root")!).render(<PostComposerUiHarness />);
