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
  return <AdminShell><header className="page-header"><div><span className="eyebrow">Security operations</span><h1>Sessions</h1><p>Review active and revoked refresh-token sessions.</p></div></header><section className="panel"><div className="table-wrap"><table><thead><tr><th>Session</th><th>User</th><th>Client</th><th>Expires</th><th>Status</th><th /></tr></thead><tbody>{sessions.map((session)=><tr key={session.id}><td><strong>{session.id.slice(0,12)}</strong><small>{session.ipAddress ?? "Unknown IP"}</small></td><td>{session.userId.slice(0,12)}</td><td>{session.userAgent ?? "Unknown client"}</td><td>{new Date(session.expiresAt).toLocaleString()}</td><td>{session.revokedAt ? "Revoked" : "Active"}</td><td>{session.revokedAt ? null : <button className="ghost-button" onClick={()=>void revoke(session.id)}>Revoke</button>}</td></tr>)}</tbody></table></div></section></AdminShell>;
}
