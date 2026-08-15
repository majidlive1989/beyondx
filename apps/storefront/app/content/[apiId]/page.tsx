import Link from "next/link";
import { BeyondXApiError } from "@beyondx/theme-sdk";
import { beyondx } from "@/lib/beyondx";
import { readableTitle } from "@/lib/seo";

export const revalidate = 60;

interface ContentListPageProps {
  params: Promise<{ apiId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContentListPage({ params, searchParams }: ContentListPageProps) {
  const { apiId } = await params;
  const query = await searchParams;
  const locale = first(query.locale) || "en";
  const page = positiveInt(first(query.page), 1);

  try {
    const result = await beyondx.content.list(apiId, { locale, page, pageSize: 12 });
    return (
      <section className="section-block page-section">
        <div className="section-heading">
          <div><span className="eyebrow">CMS public delivery</span><h1>{apiId}</h1><p>{result.total} published entr{result.total === 1 ? "y" : "ies"} · locale {locale}</p></div>
        </div>
        <form className="locale-form" action={`/content/${encodeURIComponent(apiId)}`} method="get">
          <label>Locale <input name="locale" defaultValue={locale} /></label>
          <button className="secondary" type="submit">Load locale</button>
        </form>
        {result.items.length ? (
          <div className="content-list">
            {result.items.map((entry) => (
              <article key={entry.id}>
                <span>{entry.locale} · {entry.status}</span>
                <h2><Link href={`/content/${encodeURIComponent(apiId)}/${encodeURIComponent(entry.slug)}?locale=${encodeURIComponent(locale)}`}>{readableTitle(entry)}</Link></h2>
                <p>{entry.seoDescription || `Published ${entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString("en-US") : "entry"}`}</p>
                <Link className="text-link" href={`/content/${encodeURIComponent(apiId)}/${encodeURIComponent(entry.slug)}?locale=${encodeURIComponent(locale)}`}>Read entry →</Link>
              </article>
            ))}
          </div>
        ) : <div className="empty-state"><h2>No published content</h2><p>Publish an entry for this content type and locale in BeyondX Admin.</p></div>}
      </section>
    );
  } catch (error) {
    if (error instanceof BeyondXApiError && error.status === 404) {
      return <section className="empty-state page-section"><h1>Content type not found</h1><p>No public content API exists for <code>{apiId}</code>.</p></section>;
    }
    throw error;
  }
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
