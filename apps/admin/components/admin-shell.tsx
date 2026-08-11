"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listContentTypes, listRuntimeDataSchemas, listRuntimePlugins } from "@/lib/api";
import type { ContentType, DataSchemaDefinition, PluginRuntimeState } from "@/lib/types";
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

function displayNavLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (/^[a-z0-9 _-]+$/.test(trimmed)) {
    if (trimmed.toLowerCase() === "faq" || trimmed.toLowerCase() === "faqs") return "FAQ";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
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
    if (!user) {
      setContentTypes([]);
      setContentSchemas([]);
      return;
    }

    let active = true;
    const jobs: Promise<void>[] = [];

    if (user.permissions.includes("content.types.read") && user.permissions.includes("content.entries.read")) {
      jobs.push(
        listContentTypes()
          .then((items) => {
            if (active) setContentTypes(items);
          })
          .catch(() => {
            if (active) setContentTypes([]);
          }),
      );
    } else {
      setContentTypes([]);
    }

    if (user.permissions.includes("schema.records.read")) {
      jobs.push(
        listRuntimeDataSchemas()
          .then((result) => {
            if (!active) return;
            setContentSchemas(result.items.filter((schema) => schema.kind === "COLLECTION" || schema.kind === "SINGLE"));
          })
          .catch(() => {
            if (active) setContentSchemas([]);
          }),
      );
    } else {
      setContentSchemas([]);
    }

    void Promise.all(jobs);
    return () => {
      active = false;
    };
  }, [user]);

  const groups = useMemo<NavGroup[]>(() => {
    if (!user) return [];

    const publishableContent: NavItem[] = contentTypes.map((type) => ({
      href: `/content/${encodeURIComponent(type.id)}`,
      label: displayNavLabel(type.name),
      permission: "content.entries.read",
    }));

    const generatedContent: NavItem[] = contentSchemas.map((schema) => ({
      href: `/data/${encodeURIComponent(schema.key)}`,
      label: displayNavLabel(schema.kind === "SINGLE" ? schema.displayName : schema.pluralName),
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

    const contentPluginItems = pluginGroups.get("Content") ?? [];
    pluginGroups.delete("Content");

    const contentItems: NavItem[] = [
      { href: "/content", label: "Content", exact: true },
      ...publishableContent,
      ...generatedContent,
      ...contentPluginItems,
    ];

    const candidateGroups: NavGroup[] = [
      { label: "Overview", items: [{ href: "/dashboard", label: "Dashboard", exact: true }] },
      { label: "Content", items: contentItems },
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
          { href: "/sessions", label: "Sessions", permission: "identity.sessions.manage" },
          { href: "/audit", label: "Audit log", permission: "identity.audit.read" },
          { href: "/profile", label: "Profile" },
        ],
      },
    ];

    return candidateGroups
      .map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, user.permissions)) }))
      .filter((group) => group.items.length > 0);
  }, [contentSchemas, contentTypes, runtimePlugins, user]);

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
