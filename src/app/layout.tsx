import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokyo Midnight 86 — Driving Lab",
  description: "GT86-inspired rear-wheel-drive browser driving prototype. Four-wheel suspension, six-speed automatic, and cockpit camera.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
