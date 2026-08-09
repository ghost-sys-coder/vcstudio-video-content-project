import { mkdir } from "node:fs/promises";
import path from "node:path";
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });

const authFile = path.join(process.cwd(), "playwright/.clerk/owner.json");

setup("configure Clerk testing", async () => {
  await clerkSetup();
});

setup("authenticate the workspace owner", async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL?.trim();
  if (!emailAddress)
    throw new Error(
      "E2E_CLERK_USER_EMAIL is required and must identify an existing workspace owner in the Clerk development instance.",
    );

  await mkdir(path.dirname(authFile), { recursive: true });
  await page.goto("/");
  await clerk.signIn({ page, emailAddress });
  await page.goto("/app/projects");
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page.context().storageState({ path: authFile });
});
