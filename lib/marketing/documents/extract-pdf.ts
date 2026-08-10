import type { DocumentChunk } from "@/lib/marketing/documents/chunk-document";

export async function extractPdfSections(
  bytes: Uint8Array,
): Promise<
  { text: string; sourceLocation: DocumentChunk["sourceLocation"] }[]
> {
  // PDF.js's Node fallback otherwise performs a runtime-variable import of
  // `./pdf.worker.mjs` that is explicitly hidden from bundlers. It works from
  // node_modules locally, but a Trigger deployment has no reason to retain the
  // adjacent file. Importing and registering the handler explicitly makes the
  // dependency part of the worker bundle and avoids that filesystem assumption.
  const [pdf, pdfWorker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
  ]);
  Object.defineProperty(globalThis, "pdfjsWorker", {
    configurable: true,
    value: { WorkerMessageHandler: pdfWorker.WorkerMessageHandler },
  });
  const loadingTask = pdf.getDocument({
    data: bytes,
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const document = await loadingTask.promise;
  const sections: {
    text: string;
    sourceLocation: DocumentChunk["sourceLocation"];
  }[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text)
        sections.push({
          text,
          sourceLocation: {
            kind: "page",
            start: pageNumber,
            end: pageNumber,
            label: `Page ${pageNumber}`,
          },
        });
    }
  } finally {
    await document.destroy();
  }
  return sections;
}
