import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers";
import { WalletStatus } from "@/components/wallet-status";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Augur Chambers",
  description: "Verifiable creature events and short prediction markets",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <header className="site-header">
            <Link className="brand" href="/" aria-label="Augur home"><span className="brand-mark" aria-hidden="true">◈</span>AUGUR</Link>
            <SiteNav />
            <WalletStatus />
          </header>
          <main>{children}</main>
          <footer className="site-footer"><Link className="brand" href="/">◈ AUGUR</Link><span>Observable behavior. Inspectable outcomes.</span><Link href="/health">System diagnostics ↗</Link><span>Monad Testnet · 10143</span></footer>
        </AppProviders>
      </body>
    </html>
  );
}
