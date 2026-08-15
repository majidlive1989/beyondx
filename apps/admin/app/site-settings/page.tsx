"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createDynamicRecord,
  listDynamicRecords,
  listMedia,
  listRuntimeDataSchemas,
  updateDynamicRecord,
} from "@/lib/api";
import type { DynamicDataRecord, MediaAsset } from "@/lib/types";

const SOCIAL_PLATFORMS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "X / Twitter",
  "YouTube",
  "Telegram",
  "WhatsApp",
  "TikTok",
  "GitHub",
  "Custom",
] as const;

type SocialPlatformLabel = (typeof SOCIAL_PLATFORMS)[number];

interface SocialLinkEditor {
  platform: SocialPlatformLabel;
  label: string;
  url: string;
  openInNewTab: boolean;
}

interface SiteSettingsEditor {
  siteName: string;
  companyName: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  logo: string;
  favicon: string;
  socialLinks: SocialLinkEditor[];
  footerText: string;
  copyrightText: string;
  defaultLocale: string;
  siteUrl: string;
  allowSearchIndexing: boolean;
  seoTitle: string;
  seoDescription: string;
  seoImage: string;
}

const EMPTY_SETTINGS: SiteSettingsEditor = {
  siteName: "",
  companyName: "",
  tagline: "",
  description: "",
  email: "",
  phone: "",
  address: "",
  logo: "",
  favicon: "",
  socialLinks: [],
  footerText: "",
  copyrightText: "",
  defaultLocale: "en",
  siteUrl: "",
  allowSearchIndexing: true,
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
};

export default function SiteSettingsPage() {
  const [record, setRecord] = useState<DynamicDataRecord | null>(null);
  const [values, setValues] = useState<SiteSettingsEditor>(EMPTY_SETTINGS);
  const [baseValues, setBaseValues] = useState<Record<string, unknown>>({});
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load(): Promise<void> {
    setLoading(true);
    try {
      const schemas = await listRuntimeDataSchemas();
      const settingsSchema = schemas.items.find((schema) => schema.key === "site-settings");
      if (!settingsSchema) {
        throw new Error("Site settings schema is not installed. Run pnpm db:seed once, then refresh this page.");
      }

      const [page, mediaPage] = await Promise.all([
        listDynamicRecords("site-settings", { pageSize: 1 }),
        listMedia({ pageSize: 100, kind: "IMAGE" }),
      ]);
      const current = page.items.at(0) ?? null;
      setRecord(current);
      setBaseValues(current?.values ?? {});
      setValues(toEditorValues(current?.values ?? {}));
      setMedia(mediaPage.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load site settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const publicImages = useMemo(() => media.filter(isPublicMediaAsset), [media]);

  function setField<K extends keyof SiteSettingsEditor>(key: K, value: SiteSettingsEditor[K]): void {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateSocial(index: number, patch: Partial<SocialLinkEditor>): void {
    setValues((current) => ({
      ...current,
      socialLinks: current.socialLinks.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function addSocial(): void {
    setValues((current) => ({
      ...current,
      socialLinks: [...current.socialLinks, { platform: "Instagram", label: "", url: "", openInNewTab: true }],
    }));
  }

  function removeSocial(index: number): void {
    setValues((current) => ({
      ...current,
      socialLinks: current.socialLinks.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!values.siteName.trim()) {
      setError("Site name is required.");
      return;
    }

    const invalidSocial = values.socialLinks.find((item) => !item.url.trim());
    if (invalidSocial) {
      setError("Every social network needs a URL.");
      return;
    }

    setBusy(true);
    setSuccess("");
    try {
      const payload = {
        ...baseValues,
        siteName: clean(values.siteName),
        companyName: clean(values.companyName),
        tagline: clean(values.tagline),
        description: clean(values.description),
        email: clean(values.email),
        phone: clean(values.phone),
        address: clean(values.address),
        logo: clean(values.logo),
        favicon: clean(values.favicon),
        socialLinks: values.socialLinks.map((item) => ({
          platform: platformKey(item.platform),
          label: clean(item.label) || item.platform,
          url: item.url.trim(),
          icon: platformIcon(item.platform),
          openInNewTab: item.openInNewTab,
        })),
        footerText: clean(values.footerText),
        copyrightText: clean(values.copyrightText),
        defaultLocale: clean(values.defaultLocale) || "en",
        siteUrl: clean(values.siteUrl),
        allowSearchIndexing: values.allowSearchIndexing,
        seoTitle: clean(values.seoTitle),
        seoDescription: clean(values.seoDescription),
        seoImage: clean(values.seoImage),
      };

      const saved = record
        ? await updateDynamicRecord("site-settings", record.id, { status: "ACTIVE", values: payload })
        : await createDynamicRecord("site-settings", { status: "ACTIVE", values: payload });

      setRecord(saved);
      setBaseValues(saved.values);
      setValues(toEditorValues(saved.values));
      setSuccess("Site settings saved and activated.");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save site settings");
    } finally {
      setBusy(false);
    }
  }

  return <AdminShell>
    <header className="page-header">
      <div>
        <span className="eyebrow">Website</span>
        <h1>Site settings</h1>
        <p>Manage the company identity, branding, contact details, social networks, footer and default SEO from one place.</p>
      </div>
      <span className="status status-active">Public globals</span>
    </header>

    {error ? <div className="error-banner">{error}</div> : null}
    {success ? <div className="success-banner">{success}</div> : null}

    {loading ? <section className="panel"><div className="empty-state">Loading site settings…</div></section> : (
      <form className="site-settings-form" onSubmit={(event) => void submit(event)}>
        <SettingsSection eyebrow="General" title="Company & website">
          <div className="form-grid">
            <TextField label="Site name" required value={values.siteName} onChange={(value) => setField("siteName", value)} />
            <TextField label="Company name" value={values.companyName} onChange={(value) => setField("companyName", value)} />
            <TextField label="Tagline" value={values.tagline} onChange={(value) => setField("tagline", value)} />
            <label className="full">Description<textarea value={values.description} onChange={(event) => setField("description", event.target.value)} /></label>
          </div>
        </SettingsSection>

        <SettingsSection eyebrow="Branding" title="Logo & browser identity">
          <div className="form-grid">
            <MediaSelect label="Logo" value={values.logo} assets={publicImages} onChange={(value) => setField("logo", value)} />
            <MediaSelect label="Favicon" value={values.favicon} assets={publicImages} onChange={(value) => setField("favicon", value)} />
          </div>
          <p className="settings-help">Only PUBLIC images are listed here. Change visibility from Media library before using an asset on the public site.</p>
        </SettingsSection>

        <SettingsSection eyebrow="Contact" title="Contact information">
          <div className="form-grid">
            <TextField label="Email" type="email" value={values.email} onChange={(value) => setField("email", value)} />
            <TextField label="Phone" value={values.phone} onChange={(value) => setField("phone", value)} />
            <label className="full">Address<textarea value={values.address} onChange={(event) => setField("address", event.target.value)} /></label>
          </div>
        </SettingsSection>

        <SettingsSection
          eyebrow="Social"
          title="Social networks"
          action={<button className="secondary-button" type="button" onClick={addSocial}>+ Add social network</button>}
        >
          {values.socialLinks.length === 0 ? (
            <div className="settings-empty">
              <strong>No social networks yet.</strong>
              <span>Add Instagram, LinkedIn, Telegram, WhatsApp or any custom network.</span>
            </div>
          ) : (
            <div className="social-repeater">
              {values.socialLinks.map((item, index) => (
                <div className="social-repeater-card" key={`social-${index}`}>
                  <div className="social-repeater-head">
                    <div>
                      <strong>{item.label || item.platform}</strong>
                      <small>Social link #{index + 1}</small>
                    </div>
                    <button className="danger-button compact-button" type="button" onClick={() => removeSocial(index)}>Remove</button>
                  </div>
                  <div className="form-grid">
                    <label>Platform
                      <select value={item.platform} onChange={(event) => updateSocial(index, { platform: event.target.value as SocialPlatformLabel })}>
                        {SOCIAL_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
                      </select>
                    </label>
                    <TextField label="Label (optional)" value={item.label} onChange={(value) => updateSocial(index, { label: value })} />
                    <div className="full">
                      <TextField label="URL" required type="url" value={item.url} onChange={(value) => updateSocial(index, { url: value })} />
                    </div>
                    <label className="checkbox-label full">
                      <input type="checkbox" checked={item.openInNewTab} onChange={(event) => updateSocial(index, { openInNewTab: event.target.checked })} />
                      Open in new tab
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>

        <SettingsSection eyebrow="Footer" title="Footer content">
          <div className="form-grid">
            <TextField label="Footer text" value={values.footerText} onChange={(value) => setField("footerText", value)} />
            <TextField label="Copyright text" value={values.copyrightText} onChange={(value) => setField("copyrightText", value)} />
          </div>
        </SettingsSection>

        <SettingsSection eyebrow="SEO" title="Search & sharing defaults">
          <div className="form-grid">
            <TextField label="Website URL" type="url" value={values.siteUrl} onChange={(value) => setField("siteUrl", value)} />
            <TextField label="Default locale" value={values.defaultLocale} onChange={(value) => setField("defaultLocale", value)} />
            <TextField label="Default SEO title" value={values.seoTitle} onChange={(value) => setField("seoTitle", value)} />
            <label className="full">Default SEO description<textarea value={values.seoDescription} onChange={(event) => setField("seoDescription", event.target.value)} /></label>
            <MediaSelect label="Default social / OG image" value={values.seoImage} assets={publicImages} onChange={(value) => setField("seoImage", value)} />
            <label className="checkbox-label full">
              <input type="checkbox" checked={values.allowSearchIndexing} onChange={(event) => setField("allowSearchIndexing", event.target.checked)} />
              Allow search engines to index this website
            </label>
          </div>
          <p className="settings-help">Website URL is used to build canonical URLs and sitemap entries in the frontend. Disable indexing for staging or private deployments.</p>
        </SettingsSection>

        <div className="sticky-actions site-settings-actions">
          <div>
            <strong>Site settings</strong>
            <small>{record ? "Changes update the existing single record." : "The first save creates the single site-settings record."}</small>
          </div>
          <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button>
        </div>
      </form>
    )}
  </AdminShell>;
}

function SettingsSection({ eyebrow, title, action, children }: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return <section className="panel site-settings-section">
    <div className="site-settings-section-head">
      <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      {action ?? null}
    </div>
    {children}
  </section>;
}

function TextField({ label, value, onChange, required = false, type = "text" }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "email" | "url";
}) {
  return <label>{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function MediaSelect({ label, value, assets, onChange }: {
  label: string;
  value: string;
  assets: MediaAsset[];
  onChange: (value: string) => void;
}) {
  return <label>{label}
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">None</option>
      {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title || asset.originalName}</option>)}
    </select>
  </label>;
}

function toEditorValues(raw: Record<string, unknown>): SiteSettingsEditor {
  return {
    siteName: asString(raw.siteName),
    companyName: asString(raw.companyName),
    tagline: asString(raw.tagline),
    description: asString(raw.description),
    email: asString(raw.email),
    phone: asString(raw.phone),
    address: asString(raw.address),
    logo: asString(raw.logo),
    favicon: asString(raw.favicon),
    socialLinks: normalizeSocialLinks(raw.socialLinks),
    footerText: asString(raw.footerText),
    copyrightText: asString(raw.copyrightText),
    defaultLocale: asString(raw.defaultLocale) || "en",
    siteUrl: asString(raw.siteUrl),
    allowSearchIndexing: raw.allowSearchIndexing !== false,
    seoTitle: asString(raw.seoTitle),
    seoDescription: asString(raw.seoDescription),
    seoImage: asString(raw.seoImage),
  };
}

function normalizeSocialLinks(value: unknown): SocialLinkEditor[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    const label = asString(item.label);
    const platform = socialPlatformFrom(item.platform, item.icon, label);
    return [{
      platform,
      label,
      url: asString(item.url),
      openInNewTab: item.openInNewTab !== false,
    }];
  });
}

function socialPlatformFrom(platform: unknown, icon: unknown, label: string): SocialPlatformLabel {
  const candidates = [asString(platform), asString(icon), label].map((value) => value.toLowerCase());
  if (candidates.some((value) => value.includes("instagram"))) return "Instagram";
  if (candidates.some((value) => value.includes("facebook"))) return "Facebook";
  if (candidates.some((value) => value.includes("linkedin"))) return "LinkedIn";
  if (candidates.some((value) => value === "x" || value.includes("twitter"))) return "X / Twitter";
  if (candidates.some((value) => value.includes("youtube"))) return "YouTube";
  if (candidates.some((value) => value.includes("telegram"))) return "Telegram";
  if (candidates.some((value) => value.includes("whatsapp"))) return "WhatsApp";
  if (candidates.some((value) => value.includes("tiktok"))) return "TikTok";
  if (candidates.some((value) => value.includes("github"))) return "GitHub";
  return "Custom";
}

function platformKey(platform: SocialPlatformLabel): string {
  return platform === "X / Twitter" ? "X" : platform.toUpperCase().replaceAll(" ", "_");
}

function platformIcon(platform: SocialPlatformLabel): string {
  return platform === "X / Twitter" ? "x" : platform.toLowerCase().replaceAll(" ", "-");
}

function isPublicMediaAsset(asset: MediaAsset): boolean {
  const visibility = (asset as MediaAsset & { visibility?: unknown }).visibility;
  return visibility !== "PRIVATE";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
