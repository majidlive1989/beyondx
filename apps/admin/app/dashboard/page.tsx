"use client";

import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <AdminShell>
      <header className="page-header"><div><span className="eyebrow">Platform overview</span><h1>Good to see you, {user?.firstName}.</h1><p>Identity and access management is active.</p></div><span className="status-pill">Operational</span></header>
      <section className="metric-grid">
        <article className="metric-card"><span>Account status</span><strong>{user?.status}</strong><small>Current administrator</small></article>
        <article className="metric-card"><span>Assigned roles</span><strong>{user?.roles.length ?? 0}</strong><small>{user?.roles.map((role) => role.name).join(", ")}</small></article>
        <article className="metric-card"><span>Permissions</span><strong>{user?.permissions.length ?? 0}</strong><small>Effective RBAC grants</small></article>
        <article className="metric-card"><span>Email security</span><strong>{user?.emailVerified ? "Verified" : "Pending"}</strong><small>{user?.email}</small></article>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Identity module</span><h2>Security baseline</h2></div></div><div className="check-list"><div><span>✓</span><p><strong>JWT access tokens</strong><small>Short-lived signed access tokens.</small></p></div><div><span>✓</span><p><strong>Refresh rotation</strong><small>Session-family reuse detection and revocation.</small></p></div><div><span>✓</span><p><strong>Role-based access</strong><small>Permissions are resolved through roles.</small></p></div></div></section>
    </AdminShell>
  );
}
