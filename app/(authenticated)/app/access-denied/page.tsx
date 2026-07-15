import { AccessDeniedState } from "@/components/application/AccessDeniedState";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";

export default async function AccessDeniedPage() {
  await requireAuthenticatedUser();
  return <AccessDeniedState />;
}
