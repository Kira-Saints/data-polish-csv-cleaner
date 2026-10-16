import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataPolish: Smart CSV Cleaner & Data Enrichment",
  description:
    "Upload a messy CSV, fix common data-quality problems, enrich records locally, and download a clean file.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
