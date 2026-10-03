"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell narrow">
      <section className="panel" role="alert">
        <h1>Market data unavailable</h1>
        <p>
          The configured data service did not respond. No fixture market was
          substituted.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </div>
  );
}
