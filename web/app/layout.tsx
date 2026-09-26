import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AppProviders } from "@/components/providers";
import { WalletStatus } from "@/components/wallet-status";
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
            <Link className="brand" href="/">AUGUR</Link>
            <nav aria-label="Primary navigation">
              <Link href="/">Chambers</Link>
              <Link href="/battles">The Pit</Link>
              <Link href="/chronicle">Chronicle</Link>
              <Link href="/health">Health</Link>
            </nav>
            <WalletStatus />
          </header>
          <main>{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
