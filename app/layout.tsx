import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { THEME_COOKIE } from "@/lib/theme/theme-cookie";
import {
  isValidThemePreference,
  themeClassName,
} from "@/lib/theme/theme-classes";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VCStudio",
  description:
    "Plan campaigns, create social posts and videos, manage characters and voices, and publish across connected channels with review and cost controls.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(THEME_COOKIE)?.value;
  const theme = isValidThemePreference(cookieValue) ? cookieValue : "light";

  return (
    <html
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "h-full antialiased",
        themeClassName(theme),
      )}
      lang="en"
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider appearance={{ theme: shadcn }} telemetry={false}>
          <TooltipProvider>{children}</TooltipProvider>
        </ClerkProvider>
        <Toaster />
      </body>
    </html>
  );
}
