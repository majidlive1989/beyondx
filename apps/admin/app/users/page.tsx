"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AdminShell } from "@/components/admin-shell";
import { assignUserRoles, createUser, listRoles, listUsers, updateUser } from "@/lib/api";
import type { AdminRole, AdminUser } from "@/lib/types";

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ email: "", password: "", firstName: "", lastName: "", roleIds: [] as string[] });

  async function load() {
    try {
      const [userPage, roleItems] = await Promise.all([listUsers(search), listRoles()]);
      setUsers(userPage.items); setRoles(roleItems); setError("");
      if (selected) setSelected(userPage.items.find((user) => user.id === selected.id) ?? null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load users"); }
  }
  useEffect(() => { void load(); }, []);
  const roleMap = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  async function toggleRole(roleId: string) {
    if (!selected) return;
    const current = selected.roles.map((role) => role.id);
    const next = current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId];
    const updated = await assignUserRoles(selected.id, next);
    setSelected(updated); await load();
  }

  async function changeStatus(status: AdminUser["status"]) {
    if (!selected) return;
    const updated = await updateUser(selected.id, { status });
    setSelected(updated); await load();
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createUser({ ...draft, emailVerified: true });
    setDraft({ email: "", password: "", firstName: "", lastName: "", roleIds: [] });
    setShowCreate(false);
    await load();
  }

  return <AdminShell><header className="page-header"><div><span className="eyebrow">Identity administration</span><h1>Users</h1><p>Search accounts, change status and assign roles.</p></div><button className="secondary-button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Cancel" : "New user"}</button></header>
    {showCreate ? <section className="panel form-panel"><form onSubmit={(event) => void submitCreate(event)}><span className="eyebrow">Create account</span><div className="form-grid"><label>First name<input value={draft.firstName} onChange={(event)=>setDraft({...draft,firstName:event.target.value})} required /></label><label>Last name<input value={draft.lastName} onChange={(event)=>setDraft({...draft,lastName:event.target.value})} required /></label><label>Email<input type="email" value={draft.email} onChange={(event)=>setDraft({...draft,email:event.target.value})} required /></label><label>Temporary password<input type="password" minLength={12} value={draft.password} onChange={(event)=>setDraft({...draft,password:event.target.value})} required /></label></div><fieldset><legend>Initial roles</legend>{roles.map((role)=><label className="check-row" key={role.id}><input type="checkbox" checked={draft.roleIds.includes(role.id)} onChange={()=>setDraft({...draft,roleIds:draft.roleIds.includes(role.id)?draft.roleIds.filter((id)=>id!==role.id):[...draft.roleIds,role.id]})}/><span><strong>{role.name}</strong><small>{role.description}</small></span></label>)}</fieldset><button className="primary-button">Create user</button></form></section> : null}
    <section className="panel"><div className="toolbar"><input placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="secondary-button" onClick={() => void load()}>Search</button></div>{error ? <div className="error-banner">{error}</div> : null}
      <div className="split-view"><div><div className="mobile-list desktop-hidden">{users.map((user) => <button type="button" key={user.id} className={`mobile-card ${selected?.id === user.id ? "active" : ""}`} onClick={() => setSelected(user)}><div className="mobile-card-head"><span><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></span><span className={`status status-${user.status.toLowerCase()}`}>{user.status}</span></div><div className="mobile-card-meta"><span>{user.roles.map((role) => role.name).join(", ") || "No roles"}</span><span>{user.emailVerified ? "Verified" : "Unverified"}</span></div></button>)}</div><div className="table-wrap"><table><thead><tr><th>User</th><th>Status</th><th>Roles</th><th>Verified</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} onClick={() => setSelected(user)} className={selected?.id === user.id ? "selected-row" : ""}><td><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></td><td><span className={`status status-${user.status.toLowerCase()}`}>{user.status}</span></td><td>{user.roles.map((role) => role.name).join(", ") || "—"}</td><td>{user.emailVerified ? "Yes" : "No"}</td></tr>)}</tbody></table></div></div>
      <aside className="detail-card">{selected ? <><span className="eyebrow">Selected user</span><h2>{selected.firstName} {selected.lastName}</h2><p>{selected.email}</p><label>Status<select value={selected.status} onChange={(event) => void changeStatus(event.target.value as AdminUser["status"])}><option>ACTIVE</option><option>SUSPENDED</option><option>DISABLED</option></select></label><fieldset><legend>Roles</legend>{roles.map((role) => <label className="check-row" key={role.id}><input type="checkbox" checked={selected.roles.some((item) => item.id === role.id)} onChange={() => void toggleRole(role.id)} /><span><strong>{roleMap.get(role.id)?.name}</strong><small>{role.description}</small></span></label>)}</fieldset></> : <div className="empty-state">Select a user to manage their access.</div>}</aside></div>
    </section></AdminShell>;
}
