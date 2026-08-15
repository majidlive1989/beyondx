import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark">BX</span>
        <span>
          <strong>BeyondX</strong>
          <small>Theme SDK reference</small>
        </span>
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/">Home</Link>
        <Link href="/products">Products</Link>
      </nav>
    </header>
  );
}
