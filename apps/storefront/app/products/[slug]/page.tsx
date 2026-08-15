import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BeyondXApiError, type CatalogProduct } from "@beyondx/theme-sdk";
import { beyondx, mediaUrl } from "@/lib/beyondx";
import { productMetadata } from "@/lib/seo";

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    return productMetadata(await beyondx.catalog.getProduct(slug));
  } catch (error) {
    if (error instanceof BeyondXApiError && error.status === 404) return { title: "Product not found" };
    throw error;
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  let product: CatalogProduct;
  try {
    product = await beyondx.catalog.getProduct(slug);
  } catch (error) {
    if (error instanceof BeyondXApiError && error.status === 404) notFound();
    throw error;
  }

  const manifest = await beyondx.manifest();
  const discussion = manifest.capabilities.discussions
    ? await beyondx.discussions.list("PRODUCT", product.id, { page: 1, pageSize: 10 })
    : null;
  const primaryMedia = product.media[0];

  return (
    <>
      <section className="product-detail">
        <div className="product-detail-media">
          {primaryMedia ? <img src={mediaUrl(primaryMedia.id)} alt={primaryMedia.altText || product.name} /> : <span className="media-placeholder">No public media</span>}
        </div>
        <div className="product-detail-copy">
          <span className="eyebrow">{product.brand?.name || "Catalog product"}</span>
          <h1>{product.name}</h1>
          <p className="lead">{product.description || "No product description has been published yet."}</p>
          {product.categories.length ? <div className="chips">{product.categories.map((category) => <span key={category.id}>{category.name}</span>)}</div> : null}
          <div className="detail-panel">
            <strong>Variants</strong>
            {product.variants.length ? (
              <ul className="variant-list">
                {product.variants.map((variant) => (
                  <li key={variant.id}><span>{variant.title}</span><code>{variant.sku}</code></li>
                ))}
              </ul>
            ) : <p className="muted">No active variants.</p>}
          </div>
        </div>
      </section>

      {Object.keys(product.customFields).length ? (
        <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Schema extensions</span><h2>Custom fields</h2></div></div><div className="custom-fields">{Object.entries(product.customFields).map(([key, value]) => <div key={key}><strong>{key}</strong><pre>{format(value)}</pre></div>)}</div></section>
      ) : null}

      {discussion ? (
        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">Discussion plugin</span><h2>Reviews & comments</h2></div>{discussion.rating ? <span>{discussion.rating.average ?? "—"} / 5 · {discussion.rating.count} ratings</span> : null}</div>
          {discussion.items.length ? <div className="discussion-list">{discussion.items.map((item) => <article key={item.id}><div><strong>{item.authorName}</strong><span>{item.kind}{item.rating ? ` · ${item.rating}/5` : ""}</span></div><p>{item.body}</p></article>)}</div> : <p className="muted">No public discussion entries yet.</p>}
        </section>
      ) : null}
    </>
  );
}

function format(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2) ?? "—";
}
