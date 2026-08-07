"use client";

import { AdminShell } from "@/components/admin-shell";
import { useAuth } from "@/components/auth-provider";

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <AdminShell>
      <header className="page-header"><div><span className="eyebrow">Platform overview</span><h1>Good to see you, {user?.firstName}.</h1><p>Identity, RBAC, Media and the CMS groundwork are active.</p></div><span className="status-pill">Operational</span></header>
      <section className="metric-grid">
        <article className="metric-card"><span>Account status</span><strong>{user?.status}</strong><small>Current administrator</small></article>
        <article className="metric-card"><span>Assigned roles</span><strong>{user?.roles.length ?? 0}</strong><small>{user?.roles.map((role) => role.name).join(", ")}</small></article>
        <article className="metric-card"><span>Permissions</span><strong>{user?.permissions.length ?? 0}</strong><small>Effective RBAC grants</small></article>
        <article className="metric-card"><span>Email security</span><strong>{user?.emailVerified ? "Verified" : "Pending"}</strong><small>{user?.email}</small></article>
      </section>
      <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Platform modules</span><h2>Operational baseline</h2></div></div><div className="check-list"><div><span>✓</span><p><strong>Identity & RBAC</strong><small>JWT, refresh rotation and permission guards.</small></p></div><div><span>✓</span><p><strong>Media Library</strong><small>Secure uploads, image metadata and pluggable storage.</small></p></div><div><span>✓</span><p><strong>CMS & Content</strong><small>Early groundwork retained for Phase 6 completion.</small></p></div><div><span>✓</span><p><strong>Mobile-first Admin</strong><small>Thin API client with no direct database access.</small></p></div></div></section>
    </AdminShell>
  );
}
