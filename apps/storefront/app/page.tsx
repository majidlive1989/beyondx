import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { beyondx } from "@/lib/beyondx";

export const revalidate = 60;

export default async function HomePage() {
  const manifest = await beyondx.manifest();
  const products = manifest.capabilities.catalog
    ? await beyondx.catalog.listProducts({ page: 1, pageSize: 6 })
    : null;

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Phase 5C · Next.js Theme Integration</span>
          <h1>A real frontend, powered by BeyondX.</h1>
          <p>
            This reference storefront consumes public content, catalog and media through the typed
            <code>@beyondx/theme-sdk</code> contract instead of coupling the frontend to database or storage internals.
          </p>
          <div className="hero-actions">
            {manifest.capabilities.catalog ? <Link className="primary" href="/products">Browse products</Link> : null}
            <Link className="secondary" href="/content/pages">Open CMS content</Link>
          </div>
        </div>
        <aside className="capability-card">
          <strong>Live capability manifest</strong>
          <ul>
            {Object.entries(manifest.capabilities).map(([name, enabled]) => (
              <li key={name}><span>{name}</span><b data-enabled={enabled}>{enabled ? "ready" : "off"}</b></li>
            ))}
          </ul>
        </aside>
      </section>

      {products ? (
        <section className="section-block">
          <div className="section-heading">
            <div><span className="eyebrow">Catalog</span><h2>Public products</h2></div>
            <Link className="text-link" href="/products">View all →</Link>
          </div>
          {products.items.length > 0 ? (
            <div className="product-grid">{products.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          ) : (
            <div className="empty-state"><h3>No active products yet</h3><p>Publish a Catalog product in Admin and it will render here on the next revalidation.</p></div>
          )}
        </section>
      ) : (
        <section className="empty-state"><h2>Catalog plugin is disabled</h2><p>The storefront discovered this from the Theme manifest and did not call Catalog APIs.</p></section>
      )}

      <section className="integration-grid">
        <article><span>01</span><h3>Server rendered</h3><p>App Router server components fetch through the SDK and render meaningful HTML on the server.</p></article>
        <article><span>02</span><h3>Revalidated</h3><p>Public API reads are cached for 60 seconds, giving the reference theme a production-friendly baseline.</p></article>
        <article><span>03</span><h3>Storage agnostic</h3><p>Images use stable public media endpoints; the frontend never sees local or S3 storage keys.</p></article>
      </section>
    </>
  );
}
