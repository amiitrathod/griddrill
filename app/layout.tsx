import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileNav } from "@/components/MobileNav";
import { ConsentBanner } from "@/components/ConsentBanner";
import { PRODUCT } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCT.siteUrl),
  title: { default: `${PRODUCT.name}: practise Excel formulas in your browser`, template: `%s | ${PRODUCT.name}` },
  description: PRODUCT.tagline,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-surface focus:p-2">Skip to content</a>
          <Header />
          <ConsentBanner />
          <main id="main" className="flex-1 pb-[72px] md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
