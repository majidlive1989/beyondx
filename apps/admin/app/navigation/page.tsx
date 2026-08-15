"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createDynamicRecord,
  listDynamicRecords,
  listRuntimeDataSchemas,
  updateDynamicRecord,
} from "@/lib/api";
import type { DynamicDataRecord } from "@/lib/types";

type NavigationLinkType = "PAGE" | "BLOG" | "CUSTOM";
type NavigationLinkStyle = "LINK" | "BUTTON";
type NavigationLocation = "headerItems" | "footerItems";

interface NavigationItemEditor {
  label: string;
  type: NavigationLinkType;
  pageId: string;
  url: string;
  style: NavigationLinkStyle;
  openInNewTab: boolean;
  enabled: boolean;
}

interface NavigationEditor {
  headerItems: NavigationItemEditor[];
  footerItems: NavigationItemEditor[];
}

const EMPTY_NAVIGATION: NavigationEditor = { headerItems: [], footerItems: [] };

export default function NavigationPage() {
  const [record, setRecord] = useState<DynamicDataRecord | null>(null);
  const [baseValues, setBaseValues] = useState<Record<string, unknown>>({});
  const [values, setValues] = useState<NavigationEditor>(EMPTY_NAVIGATION);
  const [pages, setPages] = useState<DynamicDataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const schemas = await listRuntimeDataSchemas();
      const installed = schemas.items.some((schema) => schema.key === "site-navigation");
      if (!installed) {
        throw new Error("Navigation schema is not installed. Run pnpm db:seed once, then refresh this page.");
      }

      const [navigationPage, pagesPage] = await Promise.all([
        listDynamicRecords("site-navigation", { pageSize: 1 }),
        listDynamicRecords("site-page", { pageSize: 100, status: "ACTIVE" }),
      ]);

      const current = navigationPage.items.at(0) ?? null;
      setRecord(current);
      setBaseValues(current?.values ?? {});
      setValues(toEditor(current?.values ?? {}));
      setPages(pagesPage.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load navigation");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function addItem(location: NavigationLocation): void {
    setValues((current) => ({
      ...current,
      [location]: [
        ...current[location],
        {
          label: "",
          type: "PAGE",
          pageId: pages[0]?.id ?? "",
          url: "",
          style: "LINK",
          openInNewTab: false,
          enabled: true,
        },
      ],
    }));
    setSuccess("");
  }

  function updateItem(location: NavigationLocation, index: number, patch: Partial<NavigationItemEditor>): void {
    setValues((current) => ({
      ...current,
      [location]: current[location].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item),
    }));
    setSuccess("");
  }

  function removeItem(location: NavigationLocation, index: number): void {
    setValues((current) => ({
      ...current,
      [location]: current[location].filter((_, itemIndex) => itemIndex !== index),
    }));
    setSuccess("");
  }

  function moveItem(location: NavigationLocation, index: number, direction: -1 | 1): void {
    setValues((current) => {
      const next = [...current[location]];
      const destination = index + direction;
      if (destination < 0 || destination >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(destination, 0, item);
      return { ...current, [location]: next };
    });
    setSuccess("");
  }

  async function save(): Promise<void> {
    const problem = validateNavigation(values);
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setSuccess("");
    try {
      const payload: Record<string, unknown> = {
        ...baseValues,
        headerItems: values.headerItems.map(toPayload),
        footerItems: values.footerItems.map(toPayload),
      };

      const saved = record
        ? await updateDynamicRecord("site-navigation", record.id, { status: "ACTIVE", values: payload })
        : await createDynamicRecord("site-navigation", { status: "ACTIVE", values: payload });

      setRecord(saved);
      setBaseValues(saved.values);
      setValues(toEditor(saved.values));
      setSuccess("Navigation saved and published.");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save navigation");
    } finally {
      setBusy(false);
    }
  }

  const pageTitles = useMemo(
    () => new Map(pages.map((page) => [page.id, recordTitle(page)])),
    [pages],
  );

  return <AdminShell>
    <header className="page-header">
      <div>
        <span className="eyebrow">Website</span>
        <h1>Navigation</h1>
        <p>Build the header and footer menus from one screen. Add a page, Blog or any custom link, then set the order.</p>
      </div>
      <button className="primary-button" type="button" disabled={busy || loading} onClick={() => void save()}>
        {busy ? "Saving…" : "Save navigation"}
      </button>
    </header>

    {error ? <div className="error-banner">{error}</div> : null}
    {success ? <div className="success-banner">{success}</div> : null}

    {loading ? <section className="panel"><div className="empty-state">Loading navigation…</div></section> : (
      <div className="navigation-workspace">
        <MenuSection
          title="Header menu"
          description="Main links shown in the website header."
          location="headerItems"
          items={values.headerItems}
          pages={pages}
          pageTitles={pageTitles}
          onAdd={() => addItem("headerItems")}
          onUpdate={(index, patch) => updateItem("headerItems", index, patch)}
          onRemove={(index) => removeItem("headerItems", index)}
          onMove={(index, direction) => moveItem("headerItems", index, direction)}
        />

        <MenuSection
          title="Footer menu"
          description="Useful links shown in the website footer."
          location="footerItems"
          items={values.footerItems}
          pages={pages}
          pageTitles={pageTitles}
          onAdd={() => addItem("footerItems")}
          onUpdate={(index, patch) => updateItem("footerItems", index, patch)}
          onRemove={(index) => removeItem("footerItems", index)}
          onMove={(index, direction) => moveItem("footerItems", index, direction)}
        />

        <section className="panel navigation-preview">
          <div className="navigation-section-head">
            <div>
              <span className="eyebrow">Preview</span>
              <h2>Menu order</h2>
              <p>This preview shows the exact published order. Disabled items are dimmed and are not returned by the public API.</p>
            </div>
          </div>
          <PreviewRow label="Header" items={values.headerItems} pageTitles={pageTitles} />
          <PreviewRow label="Footer" items={values.footerItems} pageTitles={pageTitles} />
        </section>

        <div className="sticky-actions navigation-save-bar">
          <div>
            <strong>Header {values.headerItems.length} · Footer {values.footerItems.length}</strong>
            <small>One save publishes both menus.</small>
          </div>
          <button className="primary-button" type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save navigation"}
          </button>
        </div>
      </div>
    )}
  </AdminShell>;
}

function MenuSection({
  title,
  description,
  location,
  items,
  pages,
  pageTitles,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: {
  title: string;
  description: string;
  location: NavigationLocation;
  items: NavigationItemEditor[];
  pages: DynamicDataRecord[];
  pageTitles: Map<string, string>;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<NavigationItemEditor>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return <section className="panel navigation-editor-section">
    <div className="navigation-section-head">
      <div>
        <span className="eyebrow">{location === "headerItems" ? "Header" : "Footer"}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <button className="secondary-button" type="button" onClick={onAdd}>+ Add link</button>
    </div>

    {items.length === 0 ? <div className="settings-empty">
      <strong>No links yet.</strong>
      <span>Add a link and choose a published Page, Blog or custom URL.</span>
    </div> : (
      <div className="navigation-item-list">
        {items.map((item, index) => (
          <article className={`navigation-item-card ${item.enabled ? "" : "disabled"}`} key={`${location}-${index}`}>
            <div className="navigation-item-order">
              <span>{index + 1}</span>
              <div>
                <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Move ${item.label || `link ${index + 1}`} up`}>↑</button>
                <button type="button" disabled={index === items.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move ${item.label || `link ${index + 1}`} down`}>↓</button>
              </div>
            </div>

            <div className="navigation-item-fields">
              <div className="form-grid">
                <label>
                  Label
                  <input
                    value={item.label}
                    placeholder={suggestedLabel(item, pageTitles)}
                    onChange={(event) => onUpdate(index, { label: event.target.value })}
                  />
                </label>

                <label>
                  Link to
                  <select
                    value={item.type}
                    onChange={(event) => {
                      const type = event.target.value as NavigationLinkType;
                      onUpdate(index, {
                        type,
                        ...(type === "PAGE" ? { pageId: item.pageId || pages[0]?.id || "", url: "" } : {}),
                        ...(type === "BLOG" ? { pageId: "", url: "", label: item.label || "Blog" } : {}),
                        ...(type === "CUSTOM" ? { pageId: "", url: item.url } : {}),
                      });
                    }}
                  >
                    <option value="PAGE">Published page</option>
                    <option value="BLOG">Blog</option>
                    <option value="CUSTOM">Custom link</option>
                  </select>
                </label>

                {item.type === "PAGE" ? <label className="full">
                  Page
                  <select
                    value={item.pageId}
                    onChange={(event) => {
                      const pageId = event.target.value;
                      onUpdate(index, {
                        pageId,
                        ...(item.label.trim() ? {} : { label: pageTitles.get(pageId) ?? "" }),
                      });
                    }}
                  >
                    <option value="">Choose a page…</option>
                    {pages.map((page) => <option value={page.id} key={page.id}>{recordTitle(page)}</option>)}
                  </select>
                </label> : null}

                {item.type === "CUSTOM" ? <label className="full">
                  URL
                  <input
                    value={item.url}
                    placeholder="/contact or https://example.com"
                    onChange={(event) => onUpdate(index, { url: event.target.value })}
                  />
                </label> : null}
              </div>

              <details className="navigation-item-advanced">
                <summary>Advanced</summary>
                <div className="navigation-advanced-grid">
                  <label>
                    Style
                    <select value={item.style} onChange={(event) => onUpdate(index, { style: event.target.value as NavigationLinkStyle })}>
                      <option value="LINK">Normal link</option>
                      <option value="BUTTON">Button / CTA</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={item.openInNewTab} onChange={(event) => onUpdate(index, { openInNewTab: event.target.checked })} />
                    Open in new tab
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={item.enabled} onChange={(event) => onUpdate(index, { enabled: event.target.checked })} />
                    Enabled
                  </label>
                </div>
              </details>
            </div>

            <button className="danger-button compact-button" type="button" onClick={() => onRemove(index)}>Remove</button>
          </article>
        ))}
      </div>
    )}
  </section>;
}

function PreviewRow({ label, items, pageTitles }: {
  label: string;
  items: NavigationItemEditor[];
  pageTitles: Map<string, string>;
}) {
  return <div className="navigation-preview-row">
    <strong>{label}</strong>
    <div>
      {items.length === 0 ? <span className="navigation-preview-empty">No links</span> : items.map((item, index) => (
        <span className={`${item.style === "BUTTON" ? "button" : ""} ${item.enabled ? "" : "disabled"}`} key={`${label}-${index}`}>
          {item.label.trim() || suggestedLabel(item, pageTitles) || `Link ${index + 1}`}
        </span>
      ))}
    </div>
  </div>;
}

function toEditor(raw: Record<string, unknown>): NavigationEditor {
  return {
    headerItems: toItems(raw.headerItems),
    footerItems: toItems(raw.footerItems),
  };
}

function toItems(value: unknown): NavigationItemEditor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const type: NavigationLinkType = entry.type === "BLOG" || entry.type === "CUSTOM" ? entry.type : "PAGE";
    return [{
      label: stringValue(entry.label),
      type,
      pageId: stringValue(entry.pageId),
      url: stringValue(entry.url),
      style: entry.style === "BUTTON" ? "BUTTON" : "LINK",
      openInNewTab: entry.openInNewTab === true,
      enabled: entry.enabled !== false,
    }];
  });
}

function toPayload(item: NavigationItemEditor): Record<string, unknown> {
  return {
    label: item.label.trim(),
    type: item.type,
    pageId: item.type === "PAGE" ? clean(item.pageId) : null,
    url: item.type === "CUSTOM" ? clean(item.url) : null,
    style: item.style,
    openInNewTab: item.openInNewTab,
    enabled: item.enabled,
  };
}

function validateNavigation(values: NavigationEditor): string | null {
  for (const [location, items] of [["Header", values.headerItems], ["Footer", values.footerItems]] as const) {
    for (const [index, item] of items.entries()) {
      if (!item.label.trim()) return `${location} link #${index + 1} needs a label.`;
      if (item.type === "PAGE" && !item.pageId) return `${location} link "${item.label}" needs a page.`;
      if (item.type === "CUSTOM" && !item.url.trim()) return `${location} link "${item.label}" needs a URL.`;
    }
  }
  return null;
}

function suggestedLabel(item: NavigationItemEditor, pageTitles: Map<string, string>): string {
  if (item.type === "BLOG") return "Blog";
  if (item.type === "PAGE") return pageTitles.get(item.pageId) ?? "";
  return "";
}

function recordTitle(record: DynamicDataRecord): string {
  return stringValue(record.values.title) || stringValue(record.values.slug) || record.id.slice(-6);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
