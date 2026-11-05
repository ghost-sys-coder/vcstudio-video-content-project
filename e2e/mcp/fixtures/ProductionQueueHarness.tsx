import { useSyncExternalStore } from "react";
import { ProductionQueuePageContent } from "@/components/production/ProductionQueuePageContent";
import { queueFixture } from "./queue-data";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

export function ProductionQueueHarness() {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => "",
  );
  return <ProductionQueuePageContent {...queueFixture(search)} />;
}
