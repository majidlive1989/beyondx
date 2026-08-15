import type { CatalogProduct } from "@beyondx/theme-sdk";
import Link from "next/link";
import { mediaUrl } from "@/lib/beyondx";

export function ProductCard({ product }: { product: CatalogProduct }) {
  const image = product.media[0];
  return (
    <article className="product-card">
      <Link className="product-media" href={`/products/${product.slug}`}>
        {image ? (
          <img src={mediaUrl(image.id)} alt={image.altText || product.name} loading="lazy" />
        ) : (
          <span className="media-placeholder">No public media</span>
        )}
      </Link>
      <div className="product-card-body">
        <div className="product-meta-row">
          <span>{product.brand?.name || "Unbranded"}</span>
          <span>{product.variants.length} variant{product.variants.length === 1 ? "" : "s"}</span>
        </div>
        <h2><Link href={`/products/${product.slug}`}>{product.name}</Link></h2>
        <p>{product.description || "No product description yet."}</p>
        <Link className="text-link" href={`/products/${product.slug}`}>View product →</Link>
      </div>
    </article>
  );
}
