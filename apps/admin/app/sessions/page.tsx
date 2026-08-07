"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { listSessions, revokeSession } from "@/lib/api";
import type { AdminSession } from "@/lib/types";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  async function load() { setSessions((await listSessions()).items); }
  useEffect(() => { void load(); }, []);
  async function revoke(id: string) { await revokeSession(id); await load(); }

  return <AdminShell><header className="page-header"><div><span className="eyebrow">Security operations</span><h1>Sessions</h1><p>Review active and revoked refresh-token sessions.</p></div></header><section className="panel">
    <div className="mobile-list desktop-hidden">{sessions.map((session) => <article className="mobile-card" key={session.id}><div className="mobile-card-head"><span><strong>{session.id.slice(0, 12)}</strong><small>{session.ipAddress ?? "Unknown IP"}</small></span><span className={`status ${session.revokedAt ? "status-archived" : "status-active"}`}>{session.revokedAt ? "Revoked" : "Active"}</span></div><p>{session.userAgent ?? "Unknown client"}</p><div className="mobile-card-meta"><span>User {session.userId.slice(0, 12)}</span><span>Expires {new Date(session.expiresAt).toLocaleString()}</span></div>{session.revokedAt ? null : <button className="danger-button" onClick={() => void revoke(session.id)}>Revoke session</button>}</article>)}</div>
    <div className="table-wrap"><table><thead><tr><th>Session</th><th>User</th><th>Client</th><th>Expires</th><th>Status</th><th /></tr></thead><tbody>{sessions.map((session) => <tr key={session.id}><td><strong>{session.id.slice(0, 12)}</strong><small>{session.ipAddress ?? "Unknown IP"}</small></td><td>{session.userId.slice(0, 12)}</td><td>{session.userAgent ?? "Unknown client"}</td><td>{new Date(session.expiresAt).toLocaleString()}</td><td>{session.revokedAt ? "Revoked" : "Active"}</td><td>{session.revokedAt ? null : <button className="ghost-button" onClick={() => void revoke(session.id)}>Revoke</button>}</td></tr>)}</tbody></table></div>
  </section></AdminShell>;
}
