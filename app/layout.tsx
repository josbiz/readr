import type { Metadata, Viewport } from "next";
import { Geist, Literata } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { PRE_PAINT_SCRIPT } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-reading",
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "readr",
  description: "A calm reader for your PDF and EPUB books, stored on your device.",
  applicationName: "readr",
  appleWebApp: { title: "readr", capable: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ecebe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${literata.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
