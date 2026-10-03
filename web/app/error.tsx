"use client";

import Link from "next/link";

export default function DataError({ reset }: { reset(): void }) {
  return <div className="page-shell narrow"><section className="panel">
    <p className="eyebrow">Data unavailable</p><h1>Unable to load this view.</h1>
    <p className="muted">The configured data source could not supply this page. Check indexer connectivity and runtime diagnostics, then retry.</p>
    <div className="button-row"><button className="button" onClick={reset} type="button">Retry</button><Link className="button secondary" href="/health">System diagnostics</Link></div>
  </section></div>;
}
