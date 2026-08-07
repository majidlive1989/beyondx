"use client";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { listAuditLogs } from "@/lib/api";
import type { AuditLog } from "@/lib/types";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  useEffect(()=>{void listAuditLogs().then((page)=>setLogs(page.items));},[]);
  return <AdminShell><header className="page-header"><div><span className="eyebrow">Security history</span><h1>Audit log</h1><p>Immutable identity actions with request and actor context.</p></div></header><section className="panel"><div className="table-wrap"><table><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Request</th><th>Time</th></tr></thead><tbody>{logs.map((log)=><tr key={log.id}><td><strong>{log.action}</strong><small>{log.ipAddress ?? "No IP"}</small></td><td>{log.actorUserId?.slice(0,12) ?? "System"}</td><td>{log.targetType}{log.targetId ? ` · ${log.targetId.slice(0,10)}` : ""}</td><td>{log.requestId ?? "—"}</td><td>{new Date(log.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div></section></AdminShell>;
}
