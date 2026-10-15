import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PixelHub — Creative Version Control & Design Intelligence",
  description:
    "A version-controlled creative workspace for designers — GitHub + Notion + Figma project management + AI QA.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ambient-dune font-sans text-[#141413] antialiased">
        {children}
      </body>
    </html>
  );
}
