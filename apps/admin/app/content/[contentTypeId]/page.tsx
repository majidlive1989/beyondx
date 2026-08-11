"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  archiveContentEntry,
  createContentEntry,
  deleteContentEntry,
  getDiscussionSettings,
  listContentEntries,
  listContentRevisions,
  listContentTypes,
  publishContentEntry,
  scheduleContentEntry,
  unpublishContentEntry,
  updateContentEntry,
  updateDiscussionSettings,
} from "@/lib/api";
import type { ContentEntry, ContentEntryStatus, ContentFieldDefinition, ContentRevision, ContentType, DiscussionSettings } from "@/lib/types";
import styles from "../content.module.css";

export default function PublishableContentPage() {
  const params = useParams<{ contentTypeId: string }>();
  const contentTypeId = decodeURIComponent(params.contentTypeId);
  const [types, setTypes] = useState<ContentType[]>([]);
  const [type, setType] = useState<ContentType | null>(null);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [relationOptions, setRelationOptions] = useState<ContentEntry[]>([]);
  const [selected, setSelected] = useState<ContentEntry | null>(null);
  const [revisions, setRevisions] = useState<ContentRevision[]>([]);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [relations, setRelations] = useState<Record<string, string[]>>({});
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [locale, setLocale] = useState("en");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentEntryStatus | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [discussionSettings, setDiscussionSettings] = useState<DiscussionSettings | null>(null);
  const [discussionBusy, setDiscussionBusy] = useState(false);

  const primaryTextField = useMemo(() => type?.fields.find((field) => field.type === "TEXT") ?? null, [type]);

  async function load(preferredId?: string): Promise<void> {
    try {
      const [nextTypes, page, allEntries] = await Promise.all([
        listContentTypes(),
        listContentEntries({
          contentTypeId,
          ...(search ? { search } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          pageSize: 100,
        }),
        listContentEntries({ pageSize: 100 }),
      ]);
      const currentType = nextTypes.find((item) => item.id === contentTypeId) ?? null;
      setTypes(nextTypes);
      setType(currentType);
      setEntries(page.items);
      setRelationOptions(allEntries.items);
      setError("");

      const nextSelectedId = preferredId ?? selected?.id;
      if (nextSelectedId) {
        const fresh = page.items.find((entry) => entry.id === nextSelectedId);
        if (fresh) chooseEntry(fresh, nextTypes);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load content");
    }
  }

  useEffect(() => { void load(); }, [contentTypeId]);

  function resetEditor(): void {
    setSelected(null);
    setRevisions([]);
    setData({});
    setJsonDrafts({});
    setRelations({});
    setSlug("");
    setSlugTouched(false);
    setLocale("en");
    setSeoTitle("");
    setSeoDescription("");
    setScheduleAt("");
    setDiscussionSettings(null);
    setError("");
  }

  function chooseEntry(entry: ContentEntry, knownTypes = types): void {
    setSelected(entry);
    setData(entry.data);
    setSlug(entry.slug);
    setSlugTouched(true);
    setLocale(entry.locale);
    setSeoTitle(entry.seoTitle ?? "");
    setSeoDescription(entry.seoDescription ?? "");
    setScheduleAt(entry.scheduledPublishAt ? toLocalDateTime(entry.scheduledPublishAt) : "");

    const currentType = knownTypes.find((item) => item.id === entry.contentTypeId);
    const nextJson: Record<string, string> = {};
    for (const field of currentType?.fields ?? []) {
      if (field.type === "JSON") nextJson[field.key] = JSON.stringify(entry.data[field.key] ?? {}, null, 2);
    }
    setJsonDrafts(nextJson);

    const nextRelations: Record<string, string[]> = {};
    for (const relation of entry.relations) {
      nextRelations[relation.fieldKey] = [...(nextRelations[relation.fieldKey] ?? []), relation.targetEntryId];
    }
    setRelations(nextRelations);
    void listContentRevisions(entry.id).then(setRevisions).catch(() => setRevisions([]));
    void loadDiscussionSettings(entry.id);
  }

  async function loadDiscussionSettings(entryId: string): Promise<void> {
    try {
      setDiscussionSettings(await getDiscussionSettings("CONTENT", entryId));
    } catch {
      // Discussion is an optional plugin. Keep the editor clean when it is not active
      // or when the current role cannot read discussion settings.
      setDiscussionSettings(null);
    }
  }

  async function saveDiscussionSettings(): Promise<void> {
    if (!selected || !discussionSettings) return;
    setDiscussionBusy(true);
    try {
      setDiscussionSettings(await updateDiscussionSettings("CONTENT", selected.id, discussionSettings));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save discussion settings");
    } finally {
      setDiscussionBusy(false);
    }
  }

  function setFieldValue(field: ContentFieldDefinition, value: unknown): void {
    setData((current) => ({ ...current, [field.key]: value }));
    if (!selected && !slugTouched && primaryTextField?.id === field.id && typeof value === "string") {
      setSlug(slugify(value));
    }
  }

  function buildPayloadData(): Record<string, unknown> {
    const result = { ...data };
    for (const field of type?.fields ?? []) {
      if (field.type === "RELATION") delete result[field.key];
      if (field.type === "JSON") {
        const raw = jsonDrafts[field.key] ?? JSON.stringify(result[field.key] ?? {});
        try {
          result[field.key] = JSON.parse(raw) as unknown;
        } catch {
          throw new Error(`Invalid JSON in ${field.label}`);
        }
      }
    }
    return result;
  }

  function buildRelations(): Array<{ fieldKey: string; targetEntryId: string }> {
    return (type?.fields ?? []).filter((field) => field.type === "RELATION").flatMap((field) =>
      (relations[field.key] ?? []).map((targetEntryId) => ({ fieldKey: field.key, targetEntryId })),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!type) return;
    setBusy(true);
    setError("");
    try {
      const finalSlug = slug || slugify(firstTextValue(type, data)) || `entry-${Date.now()}`;
      const payloadData = buildPayloadData();
      const relationPayload = buildRelations();
      const result = selected
        ? await updateContentEntry(selected.id, {
            slug: finalSlug,
            locale,
            data: payloadData,
            seoTitle: seoTitle || null,
            seoDescription: seoDescription || null,
            relations: relationPayload,
          })
        : await createContentEntry({
            contentTypeId: type.id,
            slug: finalSlug,
            locale,
            data: payloadData,
            seoTitle: seoTitle || null,
            seoDescription: seoDescription || null,
            relations: relationPayload,
          });
      setSlug(finalSlug);
      setSlugTouched(true);
      await load(result.id);
      chooseEntry(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save entry");
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: "publish" | "unpublish" | "archive" | "delete"): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      if (action === "delete") {
        await deleteContentEntry(selected.id);
        resetEditor();
        await load();
        return;
      }
      const result = action === "publish"
        ? await publishContentEntry(selected.id)
        : action === "unpublish"
          ? await unpublishContentEntry(selected.id)
          : await archiveContentEntry(selected.id);
      await load(result.id);
      chooseEntry(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${action} entry`);
    } finally {
      setBusy(false);
    }
  }

  async function schedule(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const result = await scheduleContentEntry(selected.id, scheduleAt ? new Date(scheduleAt).toISOString() : null);
      await load(result.id);
      chooseEntry(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to schedule entry");
    } finally {
      setBusy(false);
    }
  }

  const editorTitle = selected ? entryTitle(type, selected) : `New ${type?.name ?? "entry"}`;

  return (
    <AdminShell>
      <header className={styles.workspaceHeader}>
        <div>
          <span className="eyebrow">Content · Publishable</span>
          <h1>{type?.name ?? "Content"}</h1>
          <p>{type?.description || "Create drafts, publish, schedule and keep revision history without leaving this workspace."}</p>
        </div>
        <div className={styles.actions}>
          <Link className="secondary-button" href="/content">All content</Link>
          <button className="primary-button" type="button" onClick={resetEditor}>New {type?.name ?? "entry"}</button>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {!type ? <div className={styles.empty}>This content model is unavailable or you do not have access.</div> : (
        <div className={styles.editorLayout}>
          <section className={styles.listPanel}>
            <div className={styles.toolbar}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search content" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ContentEntryStatus | "")}>
                <option value="">All statuses</option><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option>
              </select>
              <button type="button" className="secondary-button" onClick={() => void load()}>Filter</button>
            </div>
            <div className={styles.entryList}>
              {entries.map((entry) => <button
                type="button"
                key={entry.id}
                className={`${styles.entryCard} ${selected?.id === entry.id ? styles.entryCardActive : ""}`}
                onClick={() => chooseEntry(entry)}
              >
                <div className={styles.entryTop}><strong>{entryTitle(type, entry)}</strong><StatusBadge status={entry.status} /></div>
                <div className={styles.entryMeta}><span>/{entry.slug}</span><span>{entry.locale}</span><span>Rev {entry.currentRevision}</span><span>{new Date(entry.updatedAt).toLocaleDateString()}</span></div>
              </button>)}
              {entries.length === 0 ? <div className={styles.empty}>No entries yet. Create the first one.</div> : null}
            </div>
          </section>

          <form className={styles.editorPanel} onSubmit={(event) => void save(event)}>
            <div className={styles.editorHead}>
              <div><span className="eyebrow">{selected ? `Revision ${selected.currentRevision}` : "New draft"}</span><h2>{editorTitle}</h2><p>{selected ? `Updated ${new Date(selected.updatedAt).toLocaleString()}` : "Fill the content fields and save a draft."}</p></div>
              {selected ? <StatusBadge status={selected.status} /> : null}
            </div>

            <div className={styles.formGrid}>
              <label>Locale<input value={locale} onChange={(event) => setLocale(event.target.value)} placeholder="en" required /></label>
              <label>Slug<input value={slug} onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }} placeholder="auto-generated-from-title" /></label>
            </div>

            <section className={styles.subsection}>
              <span className="eyebrow">Content</span><h3>{type.name} fields</h3>
              <div className={styles.formGrid}>{type.fields.map((field) => <FieldEditor
                key={field.id}
                field={field}
                value={data[field.key]}
                jsonDraft={jsonDrafts[field.key] ?? ""}
                selectedRelations={relations[field.key] ?? []}
                relationOptions={relationOptions}
                types={types}
                onValue={(value) => setFieldValue(field, value)}
                onJson={(value) => setJsonDrafts((current) => ({ ...current, [field.key]: value }))}
                onRelations={(value) => setRelations((current) => ({ ...current, [field.key]: value }))}
              />)}</div>
            </section>

            <section className={styles.subsection}>
              <span className="eyebrow">Search</span><h3>SEO</h3>
              <div className={styles.formGrid}>
                <label className={styles.full}>SEO title<input value={seoTitle} maxLength={120} onChange={(event) => setSeoTitle(event.target.value)} placeholder={editorTitle} /></label>
                <label className={styles.full}>SEO description<textarea value={seoDescription} maxLength={320} onChange={(event) => setSeoDescription(event.target.value)} /></label>
              </div>
            </section>

            {selected && discussionSettings ? <section className={styles.subsection}>
              <span className="eyebrow">Discussion</span><h3>Comments</h3>
              <div className="discussion-settings-card">
                <div className="discussion-settings-grid">
                  <label className="discussion-toggle"><input type="checkbox" checked={discussionSettings.commentsEnabled} onChange={(event) => setDiscussionSettings((current) => current ? { ...current, commentsEnabled: event.target.checked } : current)} />Allow comments</label>
                </div>
                <div><button className="secondary-button" type="button" disabled={discussionBusy} onClick={() => void saveDiscussionSettings()}>{discussionBusy ? "Saving…" : "Save discussion settings"}</button></div>
              </div>
            </section> : null}

            {selected ? <section className={styles.subsection}>
              <span className="eyebrow">Publishing</span><h3>Schedule</h3>
              <div className={styles.scheduleRow}><label>Publish at<input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></label><button type="button" className="secondary-button" disabled={busy} onClick={() => void schedule()}>{scheduleAt ? "Schedule" : "Clear schedule"}</button></div>
              {selected.scheduledPublishAt ? <div className="success-banner">Scheduled for {new Date(selected.scheduledPublishAt).toLocaleString()}</div> : null}
            </section> : null}

            {selected ? <section className={styles.subsection}>
              <span className="eyebrow">History</span><h3>Recent revisions</h3>
              <div className={styles.revisionList}>{revisions.slice(0, 10).map((revision) => <div className={styles.revisionItem} key={revision.id}><span><strong>Revision {revision.revision}</strong><small className="muted">{new Date(revision.createdAt).toLocaleString()}</small></span><StatusBadge status={revision.status} /></div>)}</div>
            </section> : null}

            <div className={styles.stickyActions}>
              <button className="primary-button" disabled={busy}>{busy ? "Working…" : selected ? "Save changes" : "Save draft"}</button>
              {selected?.status !== "PUBLISHED" ? <button type="button" className="secondary-button" disabled={busy || !selected} onClick={() => void runAction("publish")}>Publish</button> : <button type="button" className="secondary-button" disabled={busy} onClick={() => void runAction("unpublish")}>Unpublish</button>}
              {selected && selected.status !== "ARCHIVED" ? <button type="button" className="secondary-button" disabled={busy} onClick={() => void runAction("archive")}>Archive</button> : null}
              {selected ? <button type="button" className="danger-button" disabled={busy} onClick={() => void runAction("delete")}>Delete</button> : null}
            </div>
          </form>
        </div>
      )}
    </AdminShell>
  );
}

function FieldEditor({ field, value, jsonDraft, selectedRelations, relationOptions, types, onValue, onJson, onRelations }: {
  field: ContentFieldDefinition;
  value: unknown;
  jsonDraft: string;
  selectedRelations: string[];
  relationOptions: ContentEntry[];
  types: ContentType[];
  onValue: (value: unknown) => void;
  onJson: (value: string) => void;
  onRelations: (value: string[]) => void;
}) {
  const label = `${field.label}${field.required ? " *" : ""}`;
  const help = field.localized ? "Localized field" : undefined;
  if (field.type === "RICH_TEXT") return <label className={styles.full}>{label}<textarea value={typeof value === "string" ? value : ""} onChange={(event) => onValue(event.target.value)} required={field.required} />{help ? <small className={styles.fieldHelp}>{help}</small> : null}</label>;
  if (field.type === "BOOLEAN") return <label className={styles.check}><input type="checkbox" checked={value === true} onChange={(event) => onValue(event.target.checked)} />{label}</label>;
  if (field.type === "NUMBER") return <label>{label}<input type="number" value={typeof value === "number" ? value : ""} onChange={(event) => onValue(event.target.value === "" ? undefined : Number(event.target.value))} required={field.required} />{help ? <small className={styles.fieldHelp}>{help}</small> : null}</label>;
  if (field.type === "DATE") return <label>{label}<input type="datetime-local" value={typeof value === "string" ? toLocalDateTime(value) : ""} onChange={(event) => onValue(event.target.value ? new Date(event.target.value).toISOString() : undefined)} required={field.required} />{help ? <small className={styles.fieldHelp}>{help}</small> : null}</label>;
  if (field.type === "JSON") return <label className={styles.full}>{label}<textarea value={jsonDraft || JSON.stringify(value ?? {}, null, 2)} onChange={(event) => onJson(event.target.value)} /><small className={styles.fieldHelp}>Advanced JSON value</small></label>;
  if (field.type === "RELATION") return <fieldset className={styles.full}><legend>{label}</legend><div className={styles.relationList}>{relationOptions.map((entry) => {
    const targetType = types.find((item) => item.id === entry.contentTypeId) ?? null;
    const checked = selectedRelations.includes(entry.id);
    return <label className={styles.relationOption} key={entry.id}><input type="checkbox" checked={checked} onChange={(event) => onRelations(event.target.checked ? [...selectedRelations, entry.id] : selectedRelations.filter((id) => id !== entry.id))} /><span>{entryTitle(targetType, entry)}<small>{targetType?.name ?? entry.contentTypeApiId} · /{entry.slug}</small></span></label>;
  })}</div>{field.required ? <small className={styles.fieldHelp}>Select at least one related entry.</small> : null}</fieldset>;
  return <label>{label}<input value={typeof value === "string" ? value : ""} onChange={(event) => onValue(event.target.value)} required={field.required} />{help ? <small className={styles.fieldHelp}>{help}</small> : null}</label>;
}

function StatusBadge({ status }: { status: ContentEntryStatus }) {
  const className = status === "PUBLISHED" ? styles.statusPublished : status === "ARCHIVED" ? styles.statusArchived : styles.statusDraft;
  return <span className={`${styles.status} ${className}`}>{status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Draft"}</span>;
}

function entryTitle(type: ContentType | null, entry: ContentEntry): string {
  const value = type ? firstTextValue(type, entry.data) : "";
  return value || entry.seoTitle || entry.slug;
}

function firstTextValue(type: ContentType, data: Record<string, unknown>): string {
  for (const field of type.fields) {
    if (field.type !== "TEXT") continue;
    const value = data[field.key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function slugify(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_]+/gu, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
