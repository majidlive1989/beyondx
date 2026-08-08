"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listRuntimeDataSchemas, listRuntimePlugins } from "@/lib/api";
import type { DataSchemaDefinition, PluginRuntimeState } from "@/lib/types";
import { useAuth } from "./auth-provider";

interface NavItem {
  href: string;
  label: string;
  permission?: string;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function canSee(item: NavItem, permissions: string[]): boolean {
  return item.permission === undefined || permissions.includes(item.permission);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contentSchemas, setContentSchemas] = useState<DataSchemaDefinition[]>([]);
  const [runtimePlugins, setRuntimePlugins] = useState<PluginRuntimeState[]>([]);

  useEffect(() => {
    if (!user) {
      setRuntimePlugins([]);
      return;
    }

    let active = true;
    const loadPlugins = async (): Promise<void> => {
      try {
        const items = await listRuntimePlugins();
        if (active) setRuntimePlugins(items);
      } catch {
        if (active) setRuntimePlugins([]);
      }
    };
    const handlePluginsChanged = (): void => {
      void loadPlugins();
    };

    void loadPlugins();
    window.addEventListener("beyondx:plugins-changed", handlePluginsChanged);

    return () => {
      active = false;
      window.removeEventListener("beyondx:plugins-changed", handlePluginsChanged);
    };
  }, [user]);

  useEffect(() => {
    if (!user?.permissions.includes("schema.records.read")) {
      setContentSchemas([]);
      return;
    }

    let active = true;
    void listRuntimeDataSchemas()
      .then((result) => {
        if (!active) return;
        setContentSchemas(result.items.filter((schema) => schema.kind === "COLLECTION" || schema.kind === "SINGLE"));
      })
      .catch(() => {
        if (active) setContentSchemas([]);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const groups = useMemo<NavGroup[]>(() => {
    if (!user) return [];

    const generatedContent: NavItem[] = contentSchemas.map((schema) => ({
      href: `/data/${encodeURIComponent(schema.key)}`,
      label: schema.kind === "SINGLE" ? schema.displayName : schema.pluralName,
      permission: "schema.records.read",
    }));

    const pluginGroups = new Map<string, NavItem[]>();
    for (const plugin of runtimePlugins) {
      for (const contribution of plugin.adminNavigation) {
        const items = pluginGroups.get(contribution.group) ?? [];
        items.push({
          href: contribution.href,
          label: contribution.label,
          ...(contribution.permission === undefined ? {} : { permission: contribution.permission }),
          ...(contribution.exact === undefined ? {} : { exact: contribution.exact }),
        });
        pluginGroups.set(contribution.group, items);
      }
    }

    const candidateGroups: NavGroup[] = [
      { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", exact: true }] },
      {
        label: "Content",
        items: [
          ...generatedContent,
          { href: "/content", label: "CMS content", permission: "content.entries.read" },
        ],
      },
      ...[...pluginGroups.entries()].map(([label, items]) => ({ label, items })),
      { label: "Media", items: [{ href: "/media", label: "Media library", permission: "media.assets.read" }] },
      {
        label: "Access",
        items: [
          { href: "/users", label: "Users", permission: "identity.users.read" },
          { href: "/roles", label: "Roles & permissions", permission: "identity.roles.read" },
        ],
      },
      {
        label: "Settings",
        items: [
          { href: "/plugins", label: "Plugins", permission: "plugins.read" },
          { href: "/builder", label: "Structure builder", permission: "schema.builder.read" },
          { href: "/content-types", label: "CMS models", permission: "content.types.read" },
          { href: "/sessions", label: "Sessions", permission: "identity.sessions.manage" },
          { href: "/audit", label: "Audit log", permission: "identity.audit.read" },
          { href: "/profile", label: "Profile" },
        ],
      },
    ];

    return candidateGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, user.permissions)) }))
      .filter((group) => group.items.length > 0);
  }, [contentSchemas, runtimePlugins, user]);

  if (loading || !user) {
    return <main className="centered"><div className="loading-card">Loading BeyondX…</div></main>;
  }

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
        <nav className="sidebar-nav" aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-section" key={group.label}>
              <span className="nav-section-label">{group.label}</span>
              <div className="nav-section-links">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={isActive(pathname, item) ? "active" : ""}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
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
