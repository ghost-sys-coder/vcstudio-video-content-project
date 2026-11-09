import { z } from "zod";
import { FacebookPageSelector } from "@/components/publish/FacebookPageSelector";

const resultSchema = z.object({
  page: z
    .object({ externalAccountId: z.string(), externalAccountName: z.string() })
    .nullable(),
  error: z.string().nullable(),
});

export function FacebookSelectionHarness() {
  return (
    <main className="mx-auto max-w-5xl">
      <FacebookPageSelector
        pages={[
          {
            externalAccountId: "1351059488083028",
            externalAccountName: "Clear Work",
          },
          {
            externalAccountId: "104012148546506",
            externalAccountName: "Fair Skin Organics",
          },
        ]}
        findAction={async (_previous, data) => {
          const response = await fetch("/test-facebook-find", {
            method: "POST",
            body: data,
          });
          if (!response.ok) throw new Error("Simulated lookup failure");
          return resultSchema.parse(await response.json());
        }}
        action={async (data) => {
          const response = await fetch("/test-facebook-connect", {
            method: "POST",
            body: data,
          });
          if (!response.ok) throw new Error("Simulated connection failure");
          window.location.assign(
            new URL("/test-facebook-connected", window.location.origin).href,
          );
        }}
      />
    </main>
  );
}
