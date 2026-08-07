"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  deleteMedia,
  fetchMediaContent,
  listMedia,
  updateMedia,
  uploadMedia,
} from "@/lib/api";
import type { MediaAsset } from "@/lib/types";

export default function MediaPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"" | MediaAsset["kind"]>("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [altText, setAltText] = useState("");

  async function load() {
    try {
      const page = await listMedia({
        ...(search ? { search } : {}),
        ...(kind ? { kind } : {}),
      });
      setAssets(page.items);
      setSelected((current) =>
        current ? page.items.find((item) => item.id === current.id) ?? current : null,
      );
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load media library");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    try {
      const asset = await uploadMedia({
        file,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(altText.trim() ? { altText: altText.trim() } : {}),
      });
      setFile(null);
      setTitle("");
      setAltText("");
      setShowUpload(false);
      setSelected(asset);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await updateMedia(selected.id, {
        title: selected.title,
        altText: selected.kind === "IMAGE" ? selected.altText : null,
      });
      setSelected(updated);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update media");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected || !window.confirm(`Delete ${selected.originalName}?`)) return;
    setBusy(true);
    try {
      await deleteMedia(selected.id);
      setSelected(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to delete media");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Phase 2 · Media Module</span>
          <h1>Media library</h1>
          <p>Upload, inspect and manage reusable files without coupling the Admin UI to storage.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => setShowUpload((value) => !value)}
        >
          {showUpload ? "Close upload" : "Upload media"}
        </button>
      </header>

      {showUpload ? (
        <section className="panel media-upload-panel">
          <form onSubmit={(event) => void submitUpload(event)}>
            <div className="form-grid">
              <label className="full">
                File
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    if (nextFile && !nextFile.type.startsWith("image/")) setAltText("");
                  }}
                  required
                />
              </label>
              <label>
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={160}
                  placeholder="Optional internal title"
                />
              </label>
              <label>
                Image alt text
                <input
                  value={altText}
                  onChange={(event) => setAltText(event.target.value)}
                  maxLength={500}
                  placeholder="Describe the image"
                  disabled={file !== null && !file.type.startsWith("image/")}
                />
              </label>
            </div>
            <div className="upload-note">
              PNG, JPEG, WebP, GIF and PDF. File content is verified by signature, not only the browser MIME type.
            </div>
            <button className="primary-button" disabled={busy || !file}>
              {busy ? "Uploading…" : "Upload"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="panel">
        <div className="toolbar media-toolbar">
          <input
            placeholder="Search filename, title or alt text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Filter media kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as "" | MediaAsset["kind"])}
          >
            <option value="">All media</option>
            <option value="IMAGE">Images</option>
            <option value="FILE">Files</option>
          </select>
          <button className="secondary-button" type="button" onClick={() => void load()}>
            Filter
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <div className="media-layout">
          <div>
            {assets.length === 0 ? (
              <div className="empty-state">No media assets match this filter.</div>
            ) : (
              <div className="media-grid">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className={`media-card ${selected?.id === asset.id ? "active" : ""}`}
                    onClick={() => setSelected(asset)}
                  >
                    <div className={`media-card-icon ${asset.kind.toLowerCase()}`}>
                      {asset.kind === "IMAGE" ? "IMG" : "FILE"}
                    </div>
                    <div className="media-card-copy">
                      <strong>{asset.title || asset.originalName}</strong>
                      <small>{asset.originalName}</small>
                      <span>{asset.mimeType}</span>
                      <span>
                        {formatBytes(asset.sizeBytes)}
                        {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="detail-card media-detail">
            {selected ? (
              <>
                <MediaPreview asset={selected} />
                <span className="eyebrow">Selected asset</span>
                <h2>{selected.title || selected.originalName}</h2>
                <dl className="media-metadata">
                  <div><dt>MIME</dt><dd>{selected.mimeType}</dd></div>
                  <div><dt>Size</dt><dd>{formatBytes(selected.sizeBytes)}</dd></div>
                  <div><dt>Storage</dt><dd>{selected.storageProvider}</dd></div>
                  <div><dt>Checksum</dt><dd className="mono">{selected.checksumSha256.slice(0, 16)}…</dd></div>
                  {selected.width && selected.height ? (
                    <div><dt>Dimensions</dt><dd>{selected.width} × {selected.height}</dd></div>
                  ) : null}
                </dl>

                <form onSubmit={(event) => void saveMetadata(event)}>
                  <label>
                    Title
                    <input
                      value={selected.title ?? ""}
                      maxLength={160}
                      onChange={(event) =>
                        setSelected({ ...selected, title: event.target.value || null })
                      }
                    />
                  </label>
                  {selected.kind === "IMAGE" ? (
                    <label>
                      Alt text
                      <textarea
                        value={selected.altText ?? ""}
                        maxLength={500}
                        onChange={(event) =>
                          setSelected({ ...selected, altText: event.target.value || null })
                        }
                      />
                    </label>
                  ) : null}
                  <div className="action-row">
                    <button className="primary-button" disabled={busy}>
                      Save metadata
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeSelected()}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="empty-state">Select a media asset to inspect it.</div>
            )}
          </aside>
        </div>
      </section>
    </AdminShell>
  );
}

function MediaPreview({ asset }: { asset: MediaAsset }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);

    if (asset.kind !== "IMAGE") return () => undefined;

    void fetchMediaContent(asset.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.id, asset.kind]);

  if (asset.kind !== "IMAGE") {
    return <div className="media-preview file-preview">PDF / File asset</div>;
  }
  if (failed) return <div className="media-preview">Preview unavailable</div>;
  if (!url) return <div className="media-preview">Loading preview…</div>;
  return <img className="media-preview-image" src={url} alt={asset.altText ?? ""} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
