"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  deleteDiscussion,
  listDiscussions,
  replyToDiscussion,
  setDiscussionStatus,
} from "@/lib/api";
import type {
  DiscussionEntry,
  DiscussionKind,
  DiscussionSourceType,
  DiscussionStatus,
} from "@/lib/types";

const STATUSES: Array<{ value: "" | DiscussionStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "SPAM", label: "Spam" },
  { value: "TRASH", label: "Trash" },
];

export default function CommentsPage() {
  const [items, setItems] = useState<DiscussionEntry[]>([]);
  const [status, setStatus] = useState<"" | DiscussionStatus>("PENDING");
  const [sourceType, setSourceType] = useState<"" | DiscussionSourceType>("");
  const [kind, setKind] = useState<"" | DiscussionKind>("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  async function load(preferredId?: string): Promise<void> {
    try {
      const page = await listDiscussions({
        ...(status ? { status } : {}),
        ...(sourceType ? { sourceType } : {}),
        ...(kind ? { kind } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        pageSize: 100,
      });
      setItems(page.items);
      const nextId = preferredId ?? selectedId;
      setSelectedId(nextId && page.items.some((item) => item.id === nextId) ? nextId : page.items[0]?.id ?? null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load comments and reviews");
    }
  }

  useEffect(() => {
    void load();
  }, [status, sourceType, kind]);

  async function moderate(nextStatus: DiscussionStatus): Promise<void> {
    if (!selected) return;
    setBusy(true);
    try {
      await setDiscussionStatus(selected.id, nextStatus);
      await load(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to moderate this entry");
    } finally {
      setBusy(false);
    }
  }

  async function reply(): Promise<void> {
    if (!selected || !replyBody.trim()) return;
    setBusy(true);
    try {
      await replyToDiscussion(selected.id, replyBody.trim(), "BeyondX Team");
      setReplyBody("");
      await load(selected.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to post the reply");
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    if (!selected || !window.confirm("Permanently delete this comment or review?")) return;
    setBusy(true);
    try {
      await deleteDiscussion(selected.id);
      setSelectedId(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete this entry");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Content moderation</span>
          <h1>Comments & reviews</h1>
          <p>Moderate post comments and product reviews from one simple inbox.</p>
        </div>
      </header>

      <section className="panel discussion-panel">
        <div className="discussion-tabs" role="tablist" aria-label="Moderation status">
          {STATUSES.map((item) => (
            <button
              className={status === item.value ? "active" : ""}
              key={item.label}
              onClick={() => setStatus(item.value)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="toolbar discussion-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search author, email or message" />
          <select value={sourceType} onChange={(event) => setSourceType(event.target.value as "" | DiscussionSourceType)}>
            <option value="">Posts + products</option>
            <option value="CONTENT">Content</option>
            <option value="PRODUCT">Products</option>
          </select>
          <select value={kind} onChange={(event) => setKind(event.target.value as "" | DiscussionKind)}>
            <option value="">Comments + reviews</option>
            <option value="COMMENT">Comments</option>
            <option value="REVIEW">Reviews</option>
          </select>
          <button className="secondary-button" type="button" onClick={() => void load()}>Filter</button>
        </div>
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="discussion-layout">
          <div className="discussion-list">
            {items.map((item) => (
              <button
                className={`discussion-row ${selected?.id === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => { setSelectedId(item.id); setReplyBody(""); }}
                type="button"
              >
                <div className="discussion-row-top">
                  <strong>{item.authorName}</strong>
                  <StatusBadge status={item.status} />
                </div>
                <p>{item.body}</p>
                <div className="discussion-meta">
                  <span>{item.kind === "REVIEW" ? `Review${item.rating ? ` · ${"★".repeat(item.rating)}` : ""}` : "Comment"}</span>
                  <span>{item.sourceLabel}</span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
              </button>
            ))}
            {items.length === 0 ? <div className="empty-state">No comments or reviews match this filter.</div> : null}
          </div>

          <aside className="discussion-detail">
            {selected ? (
              <>
                <div className="discussion-detail-head">
                  <div>
                    <span className="eyebrow">{selected.kind === "REVIEW" ? "Product review" : "Comment"}</span>
                    <h2>{selected.authorName}</h2>
                    <p>{selected.authorEmail || "Team reply"}</p>
                  </div>
                  <StatusBadge status={selected.status} />
                </div>
                <div className="discussion-source-card">
                  <span>{selected.sourceType === "PRODUCT" ? "Product" : "Content"}</span>
                  <strong>{selected.sourceLabel}</strong>
                  {selected.rating ? <div className="discussion-rating" aria-label={`${selected.rating} out of 5 stars`}>{"★".repeat(selected.rating)}{"☆".repeat(5 - selected.rating)}</div> : null}
                  {selected.verifiedPurchase ? <small>Verified purchase</small> : null}
                </div>
                <div className="discussion-message">{selected.body}</div>
                <div className="button-row discussion-actions">
                  <button className="primary-button" disabled={busy} type="button" onClick={() => void moderate("APPROVED")}>Approve</button>
                  <button className="secondary-button" disabled={busy} type="button" onClick={() => void moderate("PENDING")}>Pending</button>
                  <button className="secondary-button" disabled={busy} type="button" onClick={() => void moderate("SPAM")}>Spam</button>
                  <button className="danger-button" disabled={busy} type="button" onClick={() => void moderate("TRASH")}>Trash</button>
                </div>
                <div className="discussion-reply-box">
                  <label>
                    Reply
                    <textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="Write a public reply…" />
                  </label>
                  <button className="secondary-button" disabled={busy || !replyBody.trim()} type="button" onClick={() => void reply()}>Post reply</button>
                </div>
                {selected.status === "TRASH" ? <button className="danger-button" disabled={busy} type="button" onClick={() => void remove()}>Delete permanently</button> : null}
              </>
            ) : <div className="empty-state">Select a comment or review.</div>}
          </aside>
        </div>
      </section>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: DiscussionStatus }) {
  return <span className={`discussion-status ${status.toLowerCase()}`}>{status.charAt(0)}{status.slice(1).toLowerCase()}</span>;
}
