"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { listDynamicRecords } from "@/lib/api";
import type { DataRecordStatus, DynamicDataRecord } from "@/lib/types";

type StatusFilter = "ALL" | DataRecordStatus;

export default function BlogPage() {
  const [posts, setPosts] = useState<DynamicDataRecord[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const page = await listDynamicRecords("blog-post", { pageSize: 100 });
      setPosts(page.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load blog posts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      if (status !== "ALL" && post.status !== status) return false;
      if (!query) return true;
      const title = stringValue(post, "title").toLowerCase();
      const slug = stringValue(post, "slug").toLowerCase();
      const excerpt = stringValue(post, "excerpt").toLowerCase();
      return title.includes(query) || slug.includes(query) || excerpt.includes(query);
    });
  }, [posts, search, status]);

  const counts = useMemo(() => ({
    all: posts.length,
    draft: posts.filter((post) => post.status === "DRAFT").length,
    active: posts.filter((post) => post.status === "ACTIVE").length,
    archived: posts.filter((post) => post.status === "ARCHIVED").length,
  }), [posts]);

  return <AdminShell>
    <header className="page-header">
      <div>
        <span className="eyebrow">Editorial workspace</span>
        <h1>Blog</h1>
        <p>Create, edit and publish posts without jumping between Posts, Categories and Tags.</p>
      </div>
      <div className="button-row">
        <Link className="secondary-button" href="/data/blog-category">Manage categories</Link>
        <Link className="secondary-button" href="/data/blog-tag">Manage tags</Link>
        <Link className="primary-button" href="/blog/new">+ New post</Link>
      </div>
    </header>

    {error ? <div className="error-banner">{error}</div> : null}

    <section className="blog-stat-grid">
      <StatCard label="All posts" value={counts.all} active={status === "ALL"} onClick={() => setStatus("ALL")} />
      <StatCard label="Drafts" value={counts.draft} active={status === "DRAFT"} onClick={() => setStatus("DRAFT")} />
      <StatCard label="Published" value={counts.active} active={status === "ACTIVE"} onClick={() => setStatus("ACTIVE")} />
      <StatCard label="Archived" value={counts.archived} active={status === "ARCHIVED"} onClick={() => setStatus("ARCHIVED")} />
    </section>

    <section className="panel blog-workspace">
      <div className="blog-toolbar">
        <input aria-label="Search posts" placeholder="Search title, slug or excerpt…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <button className="secondary-button" type="button" onClick={() => void load()}>Refresh</button>
      </div>

      {loading ? <div className="empty-state">Loading posts…</div>
        : filtered.length === 0 ? <div className="empty-state"><strong>No posts found.</strong><span>Create a new post or change the current filter.</span></div>
          : <div className="blog-post-list">{filtered.map((post) => <Link className="blog-post-row" href={`/blog/post/${encodeURIComponent(post.id)}`} key={post.id}>
            <div className="blog-post-copy">
              <strong>{stringValue(post, "title") || "Untitled post"}</strong>
              <span>/{stringValue(post, "slug") || "slug-not-set"}</span>
              {stringValue(post, "excerpt") ? <p>{stringValue(post, "excerpt")}</p> : null}
            </div>
            <div className="blog-post-meta">
              {boolValue(post, "isFeatured") ? <span className="editor-badge">Featured</span> : null}
              <span className={`status status-${post.status.toLowerCase()}`}>{statusLabel(post.status)}</span>
              <small>{formatDate(post.updatedAt)}</small>
            </div>
          </Link>)}</div>}
    </section>
  </AdminShell>;
}

function StatCard({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return <button className={`blog-stat-card ${active ? "active" : ""}`} type="button" onClick={onClick}><span>{label}</span><strong>{value}</strong></button>;
}
function stringValue(record: DynamicDataRecord, key: string): string { const value = record.values[key]; return typeof value === "string" ? value : ""; }
function boolValue(record: DynamicDataRecord, key: string): boolean { return record.values[key] === true; }
function statusLabel(status: DataRecordStatus): string { if (status === "ACTIVE") return "Published"; if (status === "ARCHIVED") return "Archived"; return "Draft"; }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date); }
