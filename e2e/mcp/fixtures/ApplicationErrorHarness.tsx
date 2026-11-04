import { use, useState } from "react";
import { ApplicationErrorState } from "@/components/application/ApplicationErrorState";

/** Suspends a retry like a refreshed server view; no live application data. */
export function ApplicationErrorHarness() {
  const [result, setResult] = useState<Promise<boolean> | null>(null);
  const loaded = result ? use(result) : false;
  if (loaded) return <h1>Workspace view loaded</h1>;
  return (
    <ApplicationErrorState
      reset={() => {
        setResult(
          fetch("/__retry-view", { cache: "no-store" })
            .then((response) => response.text())
            .then((text) => text === "loaded"),
        );
      }}
    />
  );
}
