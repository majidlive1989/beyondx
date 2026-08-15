"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/components/auth-provider";
import { createDynamicRecord, deleteDynamicRecord, getDynamicRecord, listDynamicRecords, listMedia, updateDynamicRecord } from "@/lib/api";
import type { DataRecordStatus, DynamicDataRecord, MediaAsset } from "@/lib/types";

interface BlogEditorProps { postId?: string; }
interface BlogFormValues {
  title: string; slug: string; excerpt: string; content: string; featuredImage: string; category: string; tags: string[];
  authorName: string; publishedAt: string; locale: string; isFeatured: boolean; seoTitle: string; seoDescription: string;
  ogImage: string; canonicalUrl: string; noIndex: boolean;
}
const EMPTY_FORM: BlogFormValues = { title:"", slug:"", excerpt:"", content:"", featuredImage:"", category:"", tags:[], authorName:"", publishedAt:"", locale:"en", isFeatured:false, seoTitle:"", seoDescription:"", ogImage:"", canonicalUrl:"", noIndex:false };

export function BlogPostEditor({ postId }: BlogEditorProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [record, setRecord] = useState<DynamicDataRecord | null>(null);
  const [baseValues, setBaseValues] = useState<Record<string, unknown>>({});
  const [values, setValues] = useState<BlogFormValues>(EMPTY_FORM);
  const [categories, setCategories] = useState<DynamicDataRecord[]>([]);
  const [tags, setTags] = useState<DynamicDataRecord[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [taxonomyBusy, setTaxonomyBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const [post, categoryPage, tagPage, mediaPage] = await Promise.all([
        postId ? getDynamicRecord("blog-post", postId) : Promise.resolve(null),
        listDynamicRecords("blog-category", { pageSize: 100 }),
        listDynamicRecords("blog-tag", { pageSize: 100 }),
        listMedia({ pageSize: 100, kind: "IMAGE" }),
      ]);
      setRecord(post); setBaseValues(post?.values ?? {});
      setValues(post ? toForm(post.values) : { ...EMPTY_FORM, authorName: user ? `${user.firstName} ${user.lastName}`.trim() : "" });
      setCategories(categoryPage.items); setTags(tagPage.items); setMedia(mediaPage.items); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load the post editor"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [postId]);

  const slugPreview = useMemo(() => values.slug.trim() || slugify(values.title) || "post-slug", [values.slug, values.title]);
  const selectedTags = useMemo(() => values.tags.map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is DynamicDataRecord => tag !== undefined), [tags, values.tags]);

  function setField<K extends keyof BlogFormValues>(key: K, value: BlogFormValues[K]): void { setValues((current) => ({ ...current, [key]: value })); setSuccess(""); }

  async function save(nextStatus: DataRecordStatus): Promise<void> {
    if (!values.title.trim()) { setError("Title is required."); return; }
    setBusy(true); setSuccess("");
    try {
      const publishedAt = nextStatus === "ACTIVE" && !values.publishedAt ? new Date().toISOString() : localDateTimeToIso(values.publishedAt);
      const payload: Record<string, unknown> = {
        ...baseValues,
        title: values.title.trim(), slug: clean(values.slug), excerpt: clean(values.excerpt), content: clean(values.content), featuredImage: clean(values.featuredImage),
        category: clean(values.category), tags: values.tags, authorName: clean(values.authorName), publishedAt, locale: clean(values.locale) ?? "en", isFeatured: values.isFeatured,
        seoTitle: clean(values.seoTitle), seoDescription: clean(values.seoDescription), ogImage: clean(values.ogImage), canonicalUrl: clean(values.canonicalUrl), noIndex: values.noIndex,
      };
      const saved = record ? await updateDynamicRecord("blog-post", record.id, { status: nextStatus, values: payload }) : await createDynamicRecord("blog-post", { status: nextStatus, values: payload });
      setRecord(saved); setBaseValues(saved.values); setValues(toForm(saved.values)); setError("");
      setSuccess(nextStatus === "ACTIVE" ? "Post published." : nextStatus === "ARCHIVED" ? "Post archived." : "Draft saved.");
      if (!record) router.replace(`/blog/post/${encodeURIComponent(saved.id)}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save the post"); }
    finally { setBusy(false); }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const name = newCategory.trim(); if (!name) return; setTaxonomyBusy(true);
    try {
      const created = await createDynamicRecord("blog-category", { status: "ACTIVE", values: { name, slug: null } });
      setCategories((current) => [...current, created]); setField("category", created.id); setNewCategory(""); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create category"); }
    finally { setTaxonomyBusy(false); }
  }

  async function createTag(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); const name = newTag.trim(); if (!name) return;
    const existing = tags.find((tag) => recordLabel(tag).toLowerCase() === name.toLowerCase());
    if (existing) { addTag(existing.id); setNewTag(""); return; }
    setTaxonomyBusy(true);
    try {
      const created = await createDynamicRecord("blog-tag", { status: "ACTIVE", values: { name, slug: null } });
      setTags((current) => [...current, created]); addTag(created.id); setNewTag(""); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create tag"); }
    finally { setTaxonomyBusy(false); }
  }

  function addTag(id: string): void { setValues((current) => current.tags.includes(id) ? current : { ...current, tags: [...current.tags, id] }); setSuccess(""); }
  function removeTag(id: string): void { setValues((current) => ({ ...current, tags: current.tags.filter((tagId) => tagId !== id) })); setSuccess(""); }

  async function removePost(): Promise<void> {
    if (!record || !window.confirm("Delete this post permanently?")) return; setBusy(true);
    try { await deleteDynamicRecord("blog-post", record.id); router.push("/blog"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete the post"); setBusy(false); }
  }

  const currentStatus = record?.status ?? "DRAFT";

  return <AdminShell>
    <header className="page-header blog-editor-header"><div><span className="eyebrow">Blog editor</span><h1>{record ? "Edit post" : "New post"}</h1><p>Write content, choose taxonomy, media and SEO without leaving this screen.</p></div><div className="button-row"><Link className="secondary-button" href="/blog">← All posts</Link>{record ? <button className="danger-button" type="button" disabled={busy} onClick={() => void removePost()}>Delete</button> : null}</div></header>
    {error ? <div className="error-banner">{error}</div> : null}{success ? <div className="success-banner">{success}</div> : null}
    {loading ? <section className="panel"><div className="empty-state">Loading editor…</div></section> : <>
      <div className="blog-editor-layout">
        <main className="blog-editor-main">
          <section className="panel blog-editor-card blog-title-card">
            <label className="blog-title-field">Title<input autoFocus placeholder="Post title" value={values.title} onChange={(event) => setField("title", event.target.value)} /></label>
            <label className="blog-slug-field">Slug<div className="blog-slug-row"><span>/blog/</span><input placeholder={slugPreview} value={values.slug} onChange={(event) => setField("slug", event.target.value)} /><button className="secondary-button compact-button" type="button" onClick={() => setField("slug", slugify(values.title))}>Generate</button></div><small>Leave blank and BeyondX will generate it from the title when you save.</small></label>
          </section>
          <section className="panel blog-editor-card"><label>Excerpt<textarea className="blog-excerpt" placeholder="Short summary shown in post lists and previews…" value={values.excerpt} onChange={(event) => setField("excerpt", event.target.value)} /></label><label>Content<textarea className="blog-content-editor" placeholder="Write the full article here…" value={values.content} onChange={(event) => setField("content", event.target.value)} /><small>Rich-text source is stored in the Schema Engine. A visual editor plugin can replace this field later without changing the API.</small></label></section>
          <details className="panel blog-editor-card blog-editor-details"><summary><span><strong>SEO</strong><small>Search title, description, OG image and canonical URL</small></span><span>Open</span></summary><div className="form-grid blog-details-grid"><label>SEO title<input value={values.seoTitle} onChange={(event) => setField("seoTitle", event.target.value)} /></label><label className="full">Meta description<textarea value={values.seoDescription} onChange={(event) => setField("seoDescription", event.target.value)} /></label><MediaSelect label="OG image" value={values.ogImage} media={media} onChange={(value) => setField("ogImage", value)} /><label>Canonical URL<input type="url" placeholder="https://example.com/blog/…" value={values.canonicalUrl} onChange={(event) => setField("canonicalUrl", event.target.value)} /></label><label className="checkbox-label full"><input type="checkbox" checked={values.noIndex} onChange={(event) => setField("noIndex", event.target.checked)} />Hide this post from search engines</label></div></details>
        </main>
        <aside className="blog-editor-sidebar">
          <section className="panel blog-editor-card"><div className="editor-card-heading"><div><span className="eyebrow">Publish</span><h2>Post settings</h2></div><span className={`status status-${currentStatus.toLowerCase()}`}>{statusLabel(currentStatus)}</span></div><div className="editor-settings-stack"><MediaSelect label="Featured image" value={values.featuredImage} media={media} onChange={(value) => setField("featuredImage", value)} /><label>Author<input value={values.authorName} onChange={(event) => setField("authorName", event.target.value)} /></label><label>Publish date<input type="datetime-local" value={values.publishedAt} onChange={(event) => setField("publishedAt", event.target.value)} /></label><label>Locale<input value={values.locale} onChange={(event) => setField("locale", event.target.value)} placeholder="en" /></label><label className="checkbox-label"><input type="checkbox" checked={values.isFeatured} onChange={(event) => setField("isFeatured", event.target.checked)} />Featured post</label></div></section>
          <section className="panel blog-editor-card"><div className="editor-card-heading"><div><span className="eyebrow">Taxonomy</span><h2>Category</h2></div></div><label>Category<select value={values.category} onChange={(event) => setField("category", event.target.value)}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{recordLabel(category)}</option>)}</select></label><form className="editor-inline-create" onSubmit={(event) => void createCategory(event)}><input aria-label="New category" placeholder="New category…" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><button className="secondary-button" disabled={taxonomyBusy || !newCategory.trim()}>+ Add</button></form></section>
          <section className="panel blog-editor-card"><div className="editor-card-heading"><div><span className="eyebrow">Taxonomy</span><h2>Tags</h2></div><span className="editor-count">{values.tags.length}</span></div>{selectedTags.length ? <div className="editor-tag-list">{selectedTags.map((tag) => <span className="editor-tag-chip" key={tag.id}>{recordLabel(tag)}<button type="button" aria-label={`Remove ${recordLabel(tag)}`} onClick={() => removeTag(tag.id)}>×</button></span>)}</div> : <p className="editor-muted">No tags selected.</p>}<label>Add existing tag<select value="" onChange={(event) => { const id = event.target.value; if (id) addTag(id); }}><option value="">Choose a tag…</option>{tags.filter((tag) => !values.tags.includes(tag.id)).map((tag) => <option key={tag.id} value={tag.id}>{recordLabel(tag)}</option>)}</select></label><form className="editor-inline-create" onSubmit={(event) => void createTag(event)}><input aria-label="New tag" placeholder="Type a new tag…" value={newTag} onChange={(event) => setNewTag(event.target.value)} /><button className="secondary-button" disabled={taxonomyBusy || !newTag.trim()}>+ Add</button></form></section>
        </aside>
      </div>
      <div className="sticky-actions blog-editor-actions"><div className="blog-save-state"><strong>{values.title.trim() || "Untitled post"}</strong><small>{record ? `Current status: ${statusLabel(record.status)}` : "Not saved yet"}</small></div><div className="button-row">{record && record.status !== "ARCHIVED" ? <button className="secondary-button" type="button" disabled={busy} onClick={() => void save("ARCHIVED")}>Archive</button> : null}<button className="secondary-button" type="button" disabled={busy} onClick={() => void save("DRAFT")}>{busy ? "Saving…" : "Save draft"}</button><button className="primary-button" type="button" disabled={busy} onClick={() => void save("ACTIVE")}>{busy ? "Saving…" : record?.status === "ACTIVE" ? "Update published" : "Publish"}</button></div></div>
    </>}
  </AdminShell>;
}

function MediaSelect({ label, value, media, onChange }: { label: string; value: string; media: MediaAsset[]; onChange: (value: string) => void }) { return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">None</option>{media.map((asset) => <option key={asset.id} value={asset.id}>{asset.title || asset.originalName}</option>)}</select><small>Choose from Media Library. Assets used on the public site should be PUBLIC.</small></label>; }
function toForm(raw: Record<string, unknown>): BlogFormValues { return { title:asString(raw.title), slug:asString(raw.slug), excerpt:asString(raw.excerpt), content:asString(raw.content), featuredImage:asString(raw.featuredImage), category:asString(raw.category), tags:asStringArray(raw.tags), authorName:asString(raw.authorName), publishedAt:isoToLocalDateTime(asString(raw.publishedAt)), locale:asString(raw.locale)||"en", isFeatured:raw.isFeatured===true, seoTitle:asString(raw.seoTitle), seoDescription:asString(raw.seoDescription), ogImage:asString(raw.ogImage), canonicalUrl:asString(raw.canonicalUrl), noIndex:raw.noIndex===true }; }
function asString(value: unknown): string { return typeof value === "string" ? value : ""; }
function asStringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function clean(value: string): string | null { const trimmed=value.trim(); return trimmed ? trimmed : null; }
function recordLabel(record: DynamicDataRecord): string { return asString(record.values.name) || asString(record.values.title) || record.id.slice(-6); }
function slugify(value: string): string { return value.trim().toLowerCase().normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,180); }
function isoToLocalDateTime(value: string): string { if (!value) return ""; const date=new Date(value); if (Number.isNaN(date.getTime())) return ""; const offset=date.getTimezoneOffset()*60_000; return new Date(date.getTime()-offset).toISOString().slice(0,16); }
function localDateTimeToIso(value: string): string | null { if (!value) return null; const date=new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function statusLabel(status: DataRecordStatus): string { if (status === "ACTIVE") return "Published"; if (status === "ARCHIVED") return "Archived"; return "Draft"; }
