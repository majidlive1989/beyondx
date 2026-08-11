"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/components/auth-provider";
import { listContentTypes, listRuntimeDataSchemas } from "@/lib/api";
import type { ContentType, DataSchemaDefinition } from "@/lib/types";
import styles from "./content.module.css";

export default function ContentHomePage() {
  const { user } = useAuth();
  const [types, setTypes] = useState<ContentType[]>([]);
  const [schemas, setSchemas] = useState<DataSchemaDefinition[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      user?.permissions.includes("content.types.read") ? listContentTypes() : Promise.resolve([]),
      user?.permissions.includes("schema.records.read")
        ? listRuntimeDataSchemas().then((result) => result.items.filter((schema) => schema.kind === "COLLECTION" || schema.kind === "SINGLE"))
        : Promise.resolve([]),
    ])
      .then(([nextTypes, nextSchemas]) => {
        if (!active) return;
        setTypes(nextTypes);
        setSchemas(nextSchemas);
        setError("");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Unable to load content workspace");
      });
    return () => { active = false; };
  }, [user]);

  const hasBuilder = user?.permissions.includes("schema.builder.read") ?? false;
  const hasLegacyModelAdmin = user?.permissions.includes("content.types.read") ?? false;
  const totalModels = useMemo(() => types.length + schemas.length, [schemas.length, types.length]);

  return (
    <AdminShell>
      <header className={styles.workspaceHeader}>
        <div>
          <span className="eyebrow">CMS</span>
          <h1>Content</h1>
          <p>Write and manage content from one place. Structure and developer settings stay out of the everyday editorial workflow.</p>
        </div>
        <div className={styles.actions}>
          {hasBuilder ? <Link className="secondary-button" href="/builder">Structure builder</Link> : null}
          {hasLegacyModelAdmin ? <Link className="secondary-button" href="/content-types">Publishable models</Link> : null}
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><span className="eyebrow">Editorial</span><h2>Publishable content</h2><p>Draft, publish, schedule and review revisions.</p></div>
          <span className={styles.badge}>{types.length} models</span>
        </div>
        {types.length ? <div className={styles.modelGrid}>{types.map((type) => (
          <Link className={styles.modelCard} href={`/content/${encodeURIComponent(type.id)}`} key={type.id}>
            <div className={styles.modelCardTop}><h3>{type.name}</h3><span className={styles.badge}>Publishable</span></div>
            <p>{type.description || `Manage ${type.name.toLowerCase()} drafts and published entries.`}</p>
            <div className={styles.modelMeta}><span>{type.fields.length} fields</span><span>Revisions</span><span>Scheduling</span><span>SEO</span></div>
          </Link>
        ))}</div> : <div className={styles.empty}>No publishable models yet. Advanced users can create one from Publishable models.</div>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><span className="eyebrow">Structured data</span><h2>Collections</h2><p>Collections created in Structure Builder appear here automatically.</p></div>
          <span className={styles.badge}>{schemas.length} structures</span>
        </div>
        {schemas.length ? <div className={styles.modelGrid}>{schemas.map((schema) => (
          <Link className={styles.modelCard} href={`/data/${encodeURIComponent(schema.key)}`} key={schema.id}>
            <div className={styles.modelCardTop}><h3>{schema.kind === "SINGLE" ? schema.displayName : schema.pluralName}</h3><span className={styles.badge}>{schema.kind === "SINGLE" ? "Single" : "Collection"}</span></div>
            <p>{schema.description || `Manage ${schema.displayName.toLowerCase()} records.`}</p>
            <div className={styles.modelMeta}><span>{schema.fields.length} fields</span><span>{schema.publicRead ? "Public read" : "Private"}</span></div>
          </Link>
        ))}</div> : <div className={styles.empty}>No collections yet. When a structure is created, editors will see it here automatically.</div>}
      </section>

      {totalModels === 0 ? <section className={styles.section}><div className={styles.empty}>Your CMS is ready. Create the first structure in Settings → Structure builder.</div></section> : null}
    </AdminShell>
  );
}
