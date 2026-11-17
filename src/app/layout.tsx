import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

// IBM Plex Sans for everything, Plex Mono for record IDs only (canvas · Type).
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Browser tab: "Assets · AssetNXG". The client brand leads inside the app;
// AssetNXG stays quietly in the tab (white-label rule).
export const metadata: Metadata = {
  title: { template: "%s · AssetNXG", default: "AssetNXG" },
  description: "Facility and asset management",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets the "dark" class before React hydrates.
    <html
      lang="en-IN"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
