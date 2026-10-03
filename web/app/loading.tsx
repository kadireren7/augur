export default function Loading() {
  return (
    <div className="page-shell" role="status" aria-label="Loading market data">
      <div className="loading-heading skeleton" />
      <div className="chamber-layout">
        <div className="loading-feed skeleton" />
        <div className="loading-market skeleton" />
      </div>
      <p className="muted">Connecting to market data…</p>
    </div>
  );
}
