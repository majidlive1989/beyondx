"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createCatalogAttribute,
  createCatalogAttributeValue,
  createCatalogBrand,
  createCatalogCategory,
  deleteCatalogAttribute,
  deleteCatalogAttributeValue,
  deleteCatalogBrand,
  deleteCatalogCategory,
  listCatalogAttributes,
  listCatalogBrands,
  listCatalogCategories,
  updateCatalogAttribute,
  updateCatalogAttributeValue,
  updateCatalogBrand,
  updateCatalogCategory,
} from "@/lib/api";
import { createSlug } from "@/lib/slug";
import type {
  CatalogAttribute,
  CatalogAttributeValue,
  CatalogBrand,
  CatalogCategory,
} from "@/lib/types";

export default function CatalogTaxonomyPage() {
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [attributes, setAttributes] = useState<CatalogAttribute[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [brandData, categoryData, attributeData] = await Promise.all([
        listCatalogBrands(),
        listCatalogCategories(),
        listCatalogAttributes(),
      ]);
      setBrands(brandData.items);
      setCategories(categoryData.items);
      setAttributes(attributeData.items);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load catalog taxonomy");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Catalog action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Catalog</span>
          <h1>Catalog setup</h1>
          <p>Manage brands, categories, attributes and reusable variant values.</p>
        </div>
        <Link className="secondary-button" href="/catalog">Back to products</Link>
      </header>
      {error ? <div className="error-banner">{error}</div> : null}
      <div className="taxonomy-grid">
        <BrandPanel brands={brands} busy={busy} run={run} />
        <CategoryPanel categories={categories} busy={busy} run={run} />
        <AttributePanel attributes={attributes} busy={busy} run={run} />
      </div>
    </AdminShell>
  );
}

function BrandPanel({ brands, busy, run }: { brands: CatalogBrand[]; busy: boolean; run: (action: () => Promise<void>) => Promise<void> }) {
  const [editing, setEditing] = useState<CatalogBrand | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function reset() {
    setEditing(null); setName(""); setDescription("");
  }
  function edit(brand: CatalogBrand) {
    setEditing(brand); setName(brand.name); setDescription(brand.description ?? "");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (editing) {
        await updateCatalogBrand(editing.id, { name, description: description.trim() || null });
      } else {
        const generatedSlug = createSlug(name);
        if (!generatedSlug) throw new Error("Name must contain at least one letter or number");
        await createCatalogBrand({
          name,
          slug: generatedSlug,
          ...(description.trim() ? { description: description.trim() } : {}),
        });
      }
      reset();
    });
  }

  return <section className="panel taxonomy-panel"><div className="section-title"><div><span className="eyebrow">Brand</span><h2>Brands</h2></div>{editing ? <button className="secondary-button" type="button" onClick={reset}>New</button> : null}</div><form onSubmit={(event) => void submit(event)}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><div className="upload-note">Slug: <strong>{editing?.slug ?? (createSlug(name) || "generated automatically")}</strong></div><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><button className="primary-button" disabled={busy}>{editing ? "Update brand" : "Create brand"}</button></form><div className="taxonomy-list">{brands.map((brand) => <div className="taxonomy-row" key={brand.id}><button type="button" className="taxonomy-main" onClick={() => edit(brand)}><strong>{brand.name}</strong><small>{brand.slug}</small></button><button className="danger-button compact-button" type="button" disabled={busy} onClick={() => void run(async () => { if (window.confirm(`Delete ${brand.name}?`)) await deleteCatalogBrand(brand.id); })}>Delete</button></div>)}</div></section>;
}

function CategoryPanel({ categories, busy, run }: { categories: CatalogCategory[]; busy: boolean; run: (action: () => Promise<void>) => Promise<void> }) {
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [position, setPosition] = useState(0);

  function reset() { setEditing(null); setName(""); setDescription(""); setParentId(""); setPosition(0); }
  function edit(category: CatalogCategory) { setEditing(category); setName(category.name); setDescription(category.description ?? ""); setParentId(category.parentId ?? ""); setPosition(category.position); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (editing) {
        await updateCatalogCategory(editing.id, {
          name,
          description: description.trim() || null,
          parentId: parentId || null,
          position,
        });
      } else {
        const generatedSlug = createSlug(name);
        if (!generatedSlug) throw new Error("Name must contain at least one letter or number");
        await createCatalogCategory({
          name,
          slug: generatedSlug,
          position,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(parentId ? { parentId } : {}),
        });
      }
      reset();
    });
  }

  return <section className="panel taxonomy-panel"><div className="section-title"><div><span className="eyebrow">Category</span><h2>Categories</h2></div>{editing ? <button className="secondary-button" type="button" onClick={reset}>New</button> : null}</div><form onSubmit={(event) => void submit(event)}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><div className="upload-note">Slug: <strong>{editing?.slug ?? (createSlug(name) || "generated automatically")}</strong></div><label>Parent<select value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">Root category</option>{categories.filter((category) => category.id !== editing?.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Position<input type="number" min={0} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><button className="primary-button" disabled={busy}>{editing ? "Update category" : "Create category"}</button></form><div className="taxonomy-list">{categories.map((category) => <div className="taxonomy-row" key={category.id}><button type="button" className="taxonomy-main" onClick={() => edit(category)}><strong>{category.name}</strong><small>{category.slug}{category.parentId ? " · child" : ""}</small></button><button className="danger-button compact-button" type="button" disabled={busy} onClick={() => void run(async () => { if (window.confirm(`Delete ${category.name}?`)) await deleteCatalogCategory(category.id); })}>Delete</button></div>)}</div></section>;
}

function AttributePanel({ attributes, busy, run }: { attributes: CatalogAttribute[]; busy: boolean; run: (action: () => Promise<void>) => Promise<void> }) {
  const [editing, setEditing] = useState<CatalogAttribute | null>(null);
  const [selected, setSelected] = useState<CatalogAttribute | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState(0);

  function resetAttribute() { setEditing(null); setName(""); setPosition(0); }
  function editAttribute(attribute: CatalogAttribute) { setSelected(attribute); setEditing(attribute); setName(attribute.name); setPosition(attribute.position); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (editing) {
        await updateCatalogAttribute(editing.id, { name, position });
      } else {
        const generatedSlug = createSlug(name);
        if (!generatedSlug) throw new Error("Name must contain at least one letter or number");
        await createCatalogAttribute({ name, slug: generatedSlug, position });
      }
      resetAttribute();
    });
  }

  const current = selected ? attributes.find((attribute) => attribute.id === selected.id) ?? null : null;

  return <section className="panel taxonomy-panel taxonomy-attribute-panel"><div className="section-title"><div><span className="eyebrow">Variant attributes</span><h2>Attributes</h2></div>{editing ? <button className="secondary-button" type="button" onClick={resetAttribute}>New</button> : null}</div><form onSubmit={(event) => void submit(event)}><div className="form-grid"><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Color" /></label><div className="upload-note">Slug: <strong>{editing?.slug ?? (createSlug(name) || "generated automatically")}</strong></div><label>Position<input type="number" min={0} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label></div><button className="primary-button" disabled={busy}>{editing ? "Update attribute" : "Create attribute"}</button></form><div className="taxonomy-list">{attributes.map((attribute) => <div className={`taxonomy-row ${current?.id === attribute.id ? "active" : ""}`} key={attribute.id}><button type="button" className="taxonomy-main" onClick={() => editAttribute(attribute)}><strong>{attribute.name}</strong><small>{attribute.values.length} values · {attribute.slug}</small></button><button className="danger-button compact-button" type="button" disabled={busy} onClick={() => void run(async () => { if (window.confirm(`Delete ${attribute.name}?`)) { await deleteCatalogAttribute(attribute.id); if (selected?.id === attribute.id) setSelected(null); } })}>Delete</button></div>)}</div>{current ? <AttributeValues attribute={current} busy={busy} run={run} /> : <div className="empty-state">Select an attribute to manage its values.</div>}</section>;
}

function AttributeValues({ attribute, busy, run }: { attribute: CatalogAttribute; busy: boolean; run: (action: () => Promise<void>) => Promise<void> }) {
  const [editing, setEditing] = useState<CatalogAttributeValue | null>(null);
  const [value, setValue] = useState("");
  const [position, setPosition] = useState(0);

  function reset() { setEditing(null); setValue(""); setPosition(attribute.values.length); }
  function edit(item: CatalogAttributeValue) { setEditing(item); setValue(item.value); setPosition(item.position); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      if (editing) {
        await updateCatalogAttributeValue(editing.id, { value, position });
      } else {
        const generatedSlug = createSlug(value);
        if (!generatedSlug) throw new Error("Value must contain at least one letter or number");
        await createCatalogAttributeValue(attribute.id, { value, slug: generatedSlug, position });
      }
      reset();
    });
  }

  return <div className="attribute-values"><div className="section-title"><h3>{attribute.name} values</h3>{editing ? <button className="secondary-button" type="button" onClick={reset}>New value</button> : null}</div><form onSubmit={(event) => void submit(event)} className="form-grid"><label>Value<input value={value} onChange={(event) => setValue(event.target.value)} required placeholder="Neon Pink" /></label><div className="upload-note">Slug: <strong>{editing?.slug ?? (createSlug(value) || "generated automatically")}</strong></div><label>Position<input type="number" min={0} value={position} onChange={(event) => setPosition(Number(event.target.value))} /></label><button className="primary-button" disabled={busy}>{editing ? "Update value" : "Add value"}</button></form><div className="value-chip-list">{attribute.values.map((item) => <div className="value-chip" key={item.id}><button type="button" onClick={() => edit(item)}><strong>{item.value}</strong><small>{item.slug}</small></button><button className="chip-delete" type="button" disabled={busy} onClick={() => void run(async () => { if (window.confirm(`Delete ${item.value}?`)) await deleteCatalogAttributeValue(item.id); })}>×</button></div>)}</div></div>;
}
