import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { env } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Without this, the Open Graph image below resolves against localhost.
  // Same precedence as the Stremio addon and the notification email: the
  // public origin when there is one, the auth origin otherwise.
  metadataBase: new URL(env.PUBLIC_URL ?? env.BETTER_AUTH_URL),
  title: "NekoStream",
  description: "Self-hosted anime tracking, with episodes from Nyaa.si.",
  openGraph: {
    title: "NekoStream",
    description: "Self-hosted anime tracking, with episodes from Nyaa.si.",
    images: ["/logo.png"],
  },
};

export const viewport: Viewport = {
  // `cover` lets the layout paint under the notch and home indicator; the
  // header and tab bar add the safe-area insets back themselves.
  viewportFit: "cover",
  themeColor: "#09090b",
  // Zoom stays available — pinching a cover or a release title is legitimate.
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
