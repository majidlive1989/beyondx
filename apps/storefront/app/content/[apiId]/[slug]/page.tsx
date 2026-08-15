import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BeyondXApiError, type ContentEntry } from "@beyondx/theme-sdk";
import { DataGrid } from "@/components/data-grid";
import { beyondx } from "@/lib/beyondx";
import { contentMetadata, readableTitle } from "@/lib/seo";

export const revalidate = 60;

interface ContentEntryPageProps {
  params: Promise<{ apiId: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: ContentEntryPageProps): Promise<Metadata> {
  const { apiId, slug } = await params;
  const query = await searchParams;
  const locale = first(query.locale) || "en";
  try {
    return contentMetadata(await beyondx.content.get(apiId, slug, locale));
  } catch (error) {
    if (error instanceof BeyondXApiError && error.status === 404) return { title: "Content not found" };
    throw error;
  }
}

export default async function ContentEntryPage({ params, searchParams }: ContentEntryPageProps) {
  const { apiId, slug } = await params;
  const query = await searchParams;
  const locale = first(query.locale) || "en";
  let entry: ContentEntry;
  try {
    entry = await beyondx.content.get(apiId, slug, locale);
  } catch (error) {
    if (error instanceof BeyondXApiError && error.status === 404) notFound();
    throw error;
  }

  const manifest = await beyondx.manifest();
  const discussion = manifest.capabilities.discussions
    ? await beyondx.discussions.list("CONTENT", entry.id, { page: 1, pageSize: 10 })
    : null;

  return (
    <article className="content-entry page-section">
      <header>
        <span className="eyebrow">{entry.contentTypeApiId} · {entry.locale}</span>
        <h1>{readableTitle(entry)}</h1>
        {entry.seoDescription ? <p className="lead">{entry.seoDescription}</p> : null}
        <div className="entry-meta"><span>Published {formatDate(entry.publishedAt)}</span><span>Updated {formatDate(entry.updatedAt)}</span></div>
      </header>
      <section className="section-block"><div className="section-heading"><div><span className="eyebrow">Schema-driven payload</span><h2>Public fields</h2></div></div><DataGrid data={entry.data} /></section>
      {discussion ? (
        <section className="section-block">
          <div className="section-heading"><div><span className="eyebrow">Discussion plugin</span><h2>Comments</h2></div></div>
          {discussion.items.length ? <div className="discussion-list">{discussion.items.map((item) => <article key={item.id}><div><strong>{item.authorName}</strong><span>{item.kind}</span></div><p>{item.body}</p></article>)}</div> : <p className="muted">No public comments yet.</p>}
        </section>
      ) : null}
    </article>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}
