import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@/src/styles/tokens.css";
import "@/src/styles/layout.css";
import "@/src/styles/typography.css";
import "@/src/styles/components.css";
import "@/src/styles/explorer.css";

export const metadata: Metadata = {
  title: "Dead Campus Atlas",
  description: "Research dashboard for U.S. educational infrastructure collapse and campus afterlives."
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
