import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { HealthBanner } from "@/components/HealthBanner";

export const metadata: Metadata = {
  title: "FinPulse — Finance Intelligence Platform",
  description:
    "AI-curated finance & investing news covering PE, VC, IB, equity research, macro, markets, and careers. Updated twice daily.",
  keywords: [
    "finance news",
    "private equity",
    "venture capital",
    "investment banking",
    "equity research",
    "markets",
    "IPO",
    "India finance",
  ],
  openGraph: {
    title: "FinPulse — Finance Intelligence Platform",
    description:
      "AI-curated finance & investing news. Updated twice daily.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <HealthBanner />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
