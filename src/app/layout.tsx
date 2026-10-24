import type { Metadata } from "next";
import "./globals.css";
import { PollingOverlay } from "@/components/polling-overlay";

export const metadata: Metadata = {
  title: "Polling conversations | RealClear research demo",
  description: "A foundation for sourced, conversational polling research.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PollingOverlay>{children}</PollingOverlay>
      </body>
    </html>
  );
}
