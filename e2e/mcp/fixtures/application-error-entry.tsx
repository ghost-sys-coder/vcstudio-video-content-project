import { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { ApplicationErrorHarness } from "./ApplicationErrorHarness";

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <Suspense fallback={<p>Loading workspace view…</p>}>
      <ApplicationErrorHarness />
    </Suspense>,
  );
