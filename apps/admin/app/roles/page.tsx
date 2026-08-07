"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { createRole, listPermissions, listRoles, updateRole } from "@/lib/api";
import type { AdminRole, Permission } from "@/lib/types";

export default function RolesPage() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<AdminRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  async function load() { const [roleItems, permissionItems] = await Promise.all([listRoles(), listPermissions()]); setRoles(roleItems); setPermissions(permissionItems); }
  useEffect(() => { void load(); }, []);
  function choose(role: AdminRole | null) { setSelected(role); setName(role?.name ?? ""); setDescription(role?.description ?? ""); setPermissionIds(role?.permissions ?? []); }
  function toggle(permissionId: string) { setPermissionIds((items) => items.includes(permissionId) ? items.filter((id) => id !== permissionId) : [...items, permissionId]); }
  async function save(event: FormEvent) { event.preventDefault(); if (selected) await updateRole(selected.id, { description, permissionIds }); else await createRole({ name, description, permissionIds }); await load(); choose(null); }

  return <AdminShell><header className="page-header"><div><span className="eyebrow">RBAC configuration</span><h1>Roles & permissions</h1><p>Compose access policies without changing the platform core.</p></div><button className="secondary-button" onClick={() => choose(null)}>New role</button></header>
    <div className="roles-layout"><section className="panel role-list"><h2>Roles</h2>{roles.map((role) => <button key={role.id} className={selected?.id === role.id ? "role-item active" : "role-item"} onClick={() => choose(role)}><span><strong>{role.name}</strong><small>{role.description ?? "No description"}</small></span><b>{role.permissions.length}</b></button>)}</section>
    <section className="panel form-panel"><form onSubmit={(event) => void save(event)}><span className="eyebrow">{selected ? "Edit role" : "Create role"}</span><h2>{selected?.name ?? "New access role"}</h2><div className="form-grid"><label>Role name<input value={name} onChange={(event) => setName(event.target.value)} disabled={selected?.system} required /></label><label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} /></label></div><fieldset className="permission-grid"><legend>Permissions</legend>{permissions.map((permission) => <label className="check-row" key={permission.id}><input type="checkbox" checked={permissionIds.includes(permission.id)} onChange={() => toggle(permission.id)} /><span><strong>{permission.id}</strong><small>{permission.description}</small></span></label>)}</fieldset><button className="primary-button">{selected ? "Save role" : "Create role"}</button></form></section></div>
  </AdminShell>;
}
