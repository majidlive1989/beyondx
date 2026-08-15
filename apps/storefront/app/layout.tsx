import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "BeyondX Storefront",
    template: "%s · BeyondX",
  },
  description: "Reference Next.js storefront powered by the BeyondX Theme SDK.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <SiteHeader />
          <main>{children}</main>
          <footer>
            <span>BeyondX Phase 5C</span>
            <span>Next.js + @beyondx/theme-sdk</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
