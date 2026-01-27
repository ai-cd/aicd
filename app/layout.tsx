import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AICD · Deploy to Sealos",
  description: "Deploy any GitHub repo to Sealos with AI-driven setup."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
