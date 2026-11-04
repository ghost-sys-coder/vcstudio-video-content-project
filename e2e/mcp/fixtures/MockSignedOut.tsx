import type { ReactNode } from "react";
export function MockSignedOut({
  when,
  children,
}: {
  when: string;
  children: ReactNode;
}) {
  return when === "signed-out" ? children : null;
}
