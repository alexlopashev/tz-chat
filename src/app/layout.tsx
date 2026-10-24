import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polling conversations | RealClear research demo",
  description: "A foundation for sourced, conversational polling research.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
