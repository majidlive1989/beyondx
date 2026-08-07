"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { listAuditLogs } from "@/lib/api";
import type { AuditLog } from "@/lib/types";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(() => { void listAuditLogs().then((page) => setLogs(page.items)); }, []);
  return <AdminShell><header className="page-header"><div><span className="eyebrow">Security & platform history</span><h1>Audit log</h1><p>Identity and CMS actions with request and actor context.</p></div></header><section className="panel">
    <div className="mobile-list desktop-hidden">{logs.map((log) => <article className="mobile-card" key={log.id}><div className="mobile-card-head"><strong>{log.action}</strong><span className="status status-draft">{log.targetType}</span></div><p>{log.actorUserId ? `Actor ${log.actorUserId.slice(0, 12)}` : "System action"}</p><div className="mobile-card-meta"><span>{log.ipAddress ?? "No IP"}</span><span>{new Date(log.createdAt).toLocaleString()}</span>{log.targetId ? <span>Target {log.targetId.slice(0, 10)}</span> : null}</div></article>)}</div>
    <div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Request</th><th>Time</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td><strong>{log.action}</strong><small>{log.ipAddress ?? "No IP"}</small></td><td>{log.actorUserId?.slice(0, 12) ?? "System"}</td><td>{log.targetType}{log.targetId ? ` · ${log.targetId.slice(0, 10)}` : ""}</td><td>{log.requestId ?? "—"}</td><td>{new Date(log.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>
  </section></AdminShell>;
}
