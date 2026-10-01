import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { StoreHydration } from "@/components/store-hydration";
import { AuthGate } from "@/components/auth-gate";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Outfit({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Beyond Queue — Patient journey & triage",
  description:
    "Priority-based patient flow for South African hospitals and clinics: register, triage, queue by urgency, and track admitted care.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <StoreHydration />
        <SiteHeader />
        <main className="flex-1">
          <AuthGate>{children}</AuthGate>
        </main>
      </body>
    </html>
  );
}
