import { ProductCard } from "@/components/product-card";
import { beyondx } from "@/lib/beyondx";

export const revalidate = 60;

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const query = await searchParams;
  const search = first(query.search);
  const brand = first(query.brand);
  const category = first(query.category);
  const page = positiveInt(first(query.page), 1);
  const manifest = await beyondx.manifest();

  if (!manifest.capabilities.catalog) {
    return <section className="empty-state"><h1>Catalog is unavailable</h1><p>Enable the Catalog plugin to use this reference route.</p></section>;
  }

  const [brands, categories, products] = await Promise.all([
    beyondx.catalog.listBrands(),
    beyondx.catalog.listCategories(),
    beyondx.catalog.listProducts({
    page,
    pageSize: 12,
    ...(search ? { search } : {}),
    ...(brand ? { brand } : {}),
      ...(category ? { category } : {}),
    }),
  ]);

  return (
    <section className="section-block page-section">
      <div className="section-heading products-heading">
        <div><span className="eyebrow">Catalog · SSR filters</span><h1>Products</h1><p>{products.total} public product{products.total === 1 ? "" : "s"}</p></div>
      </div>

      <form className="filters" action="/products" method="get">
        <label>
          Search
          <input name="search" defaultValue={search} placeholder="Product name" />
        </label>
        <label>
          Brand
          <select name="brand" defaultValue={brand}>
            <option value="">All brands</option>
            {brands.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue={category}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}
          </select>
        </label>
        <button className="primary" type="submit">Apply filters</button>
      </form>

      {products.items.length ? (
        <div className="product-grid">{products.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      ) : (
        <div className="empty-state"><h2>No products match</h2><p>Try a broader search or remove a filter.</p></div>
      )}

      {products.pageCount > 1 ? (
        <nav className="pagination" aria-label="Product pages">
          {products.page > 1 ? <a href={pageHref(query, products.page - 1)}>← Previous</a> : <span />}
          <span>Page {products.page} of {products.pageCount}</span>
          {products.page < products.pageCount ? <a href={pageHref(query, products.page + 1)}>Next →</a> : <span />}
        </nav>
      ) : null}
    </section>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pageHref(query: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    const value = first(raw);
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/products?${params.toString()}`;
}
