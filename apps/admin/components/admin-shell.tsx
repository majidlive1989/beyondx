"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "./auth-provider";

const navigation = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Content", permission: "content.entries.read" },
  { href: "/content-types", label: "Content types", permission: "content.types.read" },
  { href: "/users", label: "Users", permission: "identity.users.read" },
  { href: "/roles", label: "Roles", permission: "identity.roles.read" },
  { href: "/sessions", label: "Sessions", permission: "identity.sessions.manage" },
  { href: "/audit", label: "Audit", permission: "identity.audit.read" },
  { href: "/profile", label: "Profile" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading || !user) {
    return <main className="centered"><div className="loading-card">Loading BeyondX…</div></main>;
  }

  const visibleNavigation = navigation.filter(
    (item) => !("permission" in item) || user.permissions.includes(item.permission),
  );

  return (
    <div className="admin-layout">
      <header className="mobile-header">
        <Link href="/dashboard" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">BX</span>
          <div><strong>BeyondX</strong><small>Admin</small></div>
        </Link>
        <button className="menu-button" type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <span /> <span /> <span />
        </button>
      </header>

      {menuOpen ? <button className="nav-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}

      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <Link href="/dashboard" className="brand desktop-brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark">BX</span>
          <div><strong>BeyondX</strong><small>Admin System</small></div>
        </Link>
        <nav className="sidebar-nav">
          {visibleNavigation.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setMenuOpen(false)}>{item.label}</Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</div>
          <div className="identity"><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div>
          <button type="button" className="ghost-button" onClick={() => void logout()}>Sign out</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
