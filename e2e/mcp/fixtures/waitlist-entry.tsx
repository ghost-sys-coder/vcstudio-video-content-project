import { createRoot } from "react-dom/client";
import { WaitlistUiHarness } from "./WaitlistUiHarness";

if (new URLSearchParams(location.search).get("theme") === "dark")
  document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(<WaitlistUiHarness />);
