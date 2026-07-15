import { AuthPageFrame } from "@/components/auth/AuthPageFrame";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPageFrame>{children}</AuthPageFrame>;
}
