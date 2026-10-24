import type { Metadata } from "next";
import "./globals.css";
import { AnimatedFavicon } from "@/components/animated-favicon";
import { PollingOverlay } from "@/components/polling-overlay";

export const metadata: Metadata = {
  icons: { icon: { url: "/icon.svg", type: "image/svg+xml" } },
  title: "Polling conversations | RealClear research demo",
  description: "A foundation for sourced, conversational polling research.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AnimatedFavicon />
        <PollingOverlay>{children}</PollingOverlay>
      </body>
    </html>
  );
}
