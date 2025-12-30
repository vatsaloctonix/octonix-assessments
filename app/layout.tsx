import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Octonix Solutions | Candidate Assessment",
  description: "Minimal, honest, signal-focused candidate assessment by Octonix Solutions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
