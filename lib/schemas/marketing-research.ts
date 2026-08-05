import { z } from "zod";

const citedStatementSchema = z.object({
  statement: z.string().trim().min(1).max(2_000),
  sourceIndexes: z.array(z.number().int().nonnegative()).min(1).max(10),
});

export const researchSnapshotDocumentSchema = z.object({
  summary: z.string().trim().min(1).max(5_000),
  findings: z
    .array(
      citedStatementSchema.extend({
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(20),
  opportunities: z.array(citedStatementSchema).max(20),
  risks: z.array(citedStatementSchema).max(20),
  contentAngles: z
    .array(
      z.object({
        angle: z.string().trim().min(1).max(1_000),
        rationale: z.string().trim().min(1).max(2_000),
        sourceIndexes: z.array(z.number().int().nonnegative()).min(1).max(10),
      }),
    )
    .max(20),
});

export const researchCitationSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  snippet: z.string(),
  publishedAt: z.string().nullable(),
});

export const storedResearchSnapshotSchema = z
  .object({
    document: researchSnapshotDocumentSchema,
    citations: z.array(researchCitationSchema).min(1).max(30),
  })
  .superRefine((value, context) => {
    const cited = [
      ...value.document.findings,
      ...value.document.opportunities,
      ...value.document.risks,
      ...value.document.contentAngles,
    ];
    for (const [itemIndex, item] of cited.entries()) {
      for (const sourceIndex of item.sourceIndexes) {
        if (sourceIndex >= value.citations.length)
          context.addIssue({
            code: "custom",
            path: ["document", itemIndex, "sourceIndexes"],
            message: "Citation index is outside the supplied result set.",
          });
      }
    }
  });

export type ResearchSnapshotDocument = z.infer<
  typeof researchSnapshotDocumentSchema
>;
export type ResearchCitation = z.infer<typeof researchCitationSchema>;
