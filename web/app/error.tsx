"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset(): void }) {
  return (
    <main className="page-shell narrow">
      <section className="panel">
        <h1>Data unavailable</h1>
        <p className="error" role="alert">{error.message || "The requested Augur data could not be loaded."}</p>
        <button className="button" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}
