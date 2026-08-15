"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { deleteDynamicRecord, listDynamicRecords, updateDynamicRecord } from "@/lib/api";
import type { DataRecordStatus, DynamicDataRecord } from "@/lib/types";

type InboxFilter = "ALL" | DataRecordStatus;

export default function ContactSubmissionsPage() {
  const [items, setItems] = useState<DynamicDataRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load(nextPage = page, nextFilter = filter): Promise<void> {
    setLoading(true);
    try {
      const result = await listDynamicRecords("contact-submission", {
        page: nextPage,
        pageSize: 50,
        ...(nextFilter === "ALL" ? {} : { status: nextFilter }),
      });
      setItems(result.items);
      setPage(result.page);
      setPageCount(Math.max(1, result.pageCount));
      setTotal(result.total);
      setSelectedId((current) => current && result.items.some((item) => item.id === current)
        ? current
        : result.items[0]?.id ?? null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load contact inbox");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, filter);
  }, [filter]);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => ["name", "email", "phone", "subject", "message"]
      .some((key) => textValue(item, key).toLowerCase().includes(query)));
  }, [items, search]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  async function openSubmission(item: DynamicDataRecord): Promise<void> {
    setSelectedId(item.id);
    if (item.status !== "DRAFT") return;
    try {
      const updated = await updateDynamicRecord("contact-submission", item.id, { status: "ACTIVE" });
      replaceItem(updated);
    } catch {
      // Reading a message should still work even if the status update fails.
    }
  }

  async function changeStatus(status: DataRecordStatus): Promise<void> {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await updateDynamicRecord("contact-submission", selected.id, { status });
      if (filter !== "ALL" && filter !== status) {
        await load(page, filter);
      } else {
        replaceItem(updated);
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update message");
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!selected || !window.confirm("Delete this contact message permanently?")) return;
    setBusy(true);
    try {
      await deleteDynamicRecord("contact-submission", selected.id);
      await load(page, filter);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete message");
    } finally {
      setBusy(false);
    }
  }

  function replaceItem(updated: DynamicDataRecord): void {
    setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  return <AdminShell>
    <header className="page-header">
      <div>
        <span className="eyebrow">Messages</span>
        <h1>Contact inbox</h1>
        <p>Read and manage website enquiries from one simple inbox.</p>
      </div>
      <button className="secondary-button" type="button" disabled={loading} onClick={() => void load(page, filter)}>Refresh</button>
    </header>

    {error ? <div className="error-banner">{error}</div> : null}

    <section className="panel contact-inbox-panel">
      <div className="contact-inbox-toolbar">
        <div className="contact-inbox-tabs" role="tablist" aria-label="Message status">
          <FilterButton label="All" value="ALL" current={filter} onSelect={setFilter} />
          <FilterButton label="New" value="DRAFT" current={filter} onSelect={setFilter} />
          <FilterButton label="Read" value="ACTIVE" current={filter} onSelect={setFilter} />
          <FilterButton label="Archived" value="ARCHIVED" current={filter} onSelect={setFilter} />
        </div>
        <input
          aria-label="Search contact messages"
          placeholder="Search name, email or message…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="contact-inbox-layout">
        <div className="contact-message-list">
          <div className="contact-list-summary">
            <strong>{total} message{total === 1 ? "" : "s"}</strong>
            <span>Page {page} of {pageCount}</span>
          </div>

          {loading ? <div className="empty-state">Loading messages…</div>
            : visibleItems.length === 0 ? <div className="empty-state"><strong>No messages found.</strong><span>New website enquiries will appear here.</span></div>
              : visibleItems.map((item) => <button
                className={`contact-message-row ${selectedId === item.id ? "active" : ""} ${item.status === "DRAFT" ? "unread" : ""}`}
                key={item.id}
                type="button"
                onClick={() => void openSubmission(item)}
              >
                <span className="contact-message-avatar">{initials(textValue(item, "name"))}</span>
                <span className="contact-message-copy">
                  <span className="contact-message-row-head">
                    <strong>{textValue(item, "name") || "Unknown sender"}</strong>
                    <small>{shortDate(item.createdAt)}</small>
                  </span>
                  <span>{textValue(item, "subject") || "Contact enquiry"}</span>
                  <small>{textValue(item, "message")}</small>
                </span>
                {item.status === "DRAFT" ? <span className="contact-unread-dot" aria-label="New message" /> : null}
              </button>)}

          <div className="contact-pagination">
            <button className="secondary-button compact-button" disabled={loading || page <= 1} onClick={() => void load(page - 1, filter)}>← Previous</button>
            <button className="secondary-button compact-button" disabled={loading || page >= pageCount} onClick={() => void load(page + 1, filter)}>Next →</button>
          </div>
        </div>

        <div className="contact-message-detail">
          {selected ? <MessageDetail
            item={selected}
            busy={busy}
            onStatus={(status) => void changeStatus(status)}
            onDelete={() => void remove()}
          /> : <div className="empty-state contact-detail-empty"><strong>Select a message.</strong><span>The full enquiry will open here.</span></div>}
        </div>
      </div>
    </section>
  </AdminShell>;
}

function FilterButton({ label, value, current, onSelect }: {
  label: string;
  value: InboxFilter;
  current: InboxFilter;
  onSelect: (value: InboxFilter) => void;
}) {
  return <button className={current === value ? "active" : ""} type="button" onClick={() => onSelect(value)}>{label}</button>;
}

function MessageDetail({ item, busy, onStatus, onDelete }: {
  item: DynamicDataRecord;
  busy: boolean;
  onStatus: (status: DataRecordStatus) => void;
  onDelete: () => void;
}) {
  const name = textValue(item, "name") || "Unknown sender";
  const email = textValue(item, "email");
  const phone = textValue(item, "phone");
  const subject = textValue(item, "subject") || "Contact enquiry";
  const message = textValue(item, "message");
  const locale = textValue(item, "locale");
  const pageUrl = textValue(item, "pageUrl");
  const replyHref = email ? `mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}` : "";

  return <article className="contact-detail-card">
    <header className="contact-detail-head">
      <div>
        <span className="eyebrow">{statusLabel(item.status)}</span>
        <h2>{subject}</h2>
        <p>From <strong>{name}</strong> · {fullDate(item.createdAt)}</p>
      </div>
      <span className={`status status-${item.status.toLowerCase()}`}>{statusLabel(item.status)}</span>
    </header>

    <dl className="contact-detail-meta">
      <div><dt>Email</dt><dd>{email ? <a href={`mailto:${email}`}>{email}</a> : "—"}</dd></div>
      <div><dt>Phone</dt><dd>{phone ? <a href={`tel:${phone}`}>{phone}</a> : "—"}</dd></div>
      <div><dt>Locale</dt><dd>{locale || "—"}</dd></div>
      <div><dt>Source</dt><dd>{pageUrl || "—"}</dd></div>
    </dl>

    <div className="contact-message-body">{message || "No message content."}</div>

    <div className="contact-detail-actions">
      {replyHref ? <a className="primary-button" href={replyHref}>Reply by email</a> : null}
      {item.status !== "DRAFT" ? <button className="secondary-button" disabled={busy} onClick={() => onStatus("DRAFT")}>Mark unread</button> : null}
      {item.status === "ARCHIVED"
        ? <button className="secondary-button" disabled={busy} onClick={() => onStatus("ACTIVE")}>Move to inbox</button>
        : <button className="secondary-button" disabled={busy} onClick={() => onStatus("ARCHIVED")}>Archive</button>}
      <button className="danger-button" disabled={busy} onClick={onDelete}>Delete</button>
    </div>
  </article>;
}

function textValue(record: DynamicDataRecord, key: string): string {
  const value = record.values[key];
  return typeof value === "string" ? value : "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function statusLabel(status: DataRecordStatus): string {
  if (status === "DRAFT") return "New";
  if (status === "ARCHIVED") return "Archived";
  return "Read";
}

function shortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function fullDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
