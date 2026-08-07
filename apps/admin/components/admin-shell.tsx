"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "./auth-provider";

const navigation = [
  ["/dashboard", "Dashboard"],
  ["/users", "Users"],
  ["/roles", "Roles"],
  ["/sessions", "Sessions"],
  ["/audit", "Audit"],
  ["/profile", "Profile"],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  if (loading || !user) {
    return <main className="centered"><div className="loading-card">Loading BeyondX…</div></main>;
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">BX</span><div><strong>BeyondX</strong><small>Admin System</small></div></div>
        <nav>
          {navigation.map(([href, label]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>{label}</Link>
          ))}
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
