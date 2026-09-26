import Link from "next/link";

export default function NotFound() {
  return <div className="page-shell narrow"><section className="panel"><h1>Not found</h1><p>The requested Augur record does not exist.</p><Link className="button" href="/">Return to Chambers</Link></section></div>;
}
