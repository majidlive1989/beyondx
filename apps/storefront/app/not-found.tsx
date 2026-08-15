import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-state page-section">
      <span className="eyebrow">404</span>
      <h1>That public resource was not found.</h1>
      <p>It may be unpublished, private, archived or the URL may be incorrect.</p>
      <Link className="primary" href="/">Return home</Link>
    </section>
  );
}
