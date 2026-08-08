"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  disablePlugin,
  enablePlugin,
  installPlugin,
  listPlugins,
  refreshSession,
  uninstallPlugin,
} from "@/lib/api";
import type { PluginRuntimeState } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";

export default function PluginsPage() {
  const { setUser } = useAuth();
  const [plugins, setPlugins] = useState<PluginRuntimeState[]>([]);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setPlugins(await listPlugins());
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load plugins");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(id: string, action: () => Promise<PluginRuntimeState>) {
    setBusyId(id);
    try {
      await action();
      const session = await refreshSession();
      setUser(session.user);
      window.dispatchEvent(new Event("beyondx:plugins-changed"));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Plugin operation failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminShell>
      <header className="page-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h1>Plugins</h1>
          <p>Install only the capabilities this BeyondX instance needs. Plugin menus and APIs activate or deactivate immediately without restarting the service.</p>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      <section className="plugin-grid">
        {plugins.map((plugin) => (
          <article className="panel plugin-card" key={plugin.id}>
            <div className="plugin-card-header">
              <div>
                <span className="eyebrow">{plugin.packageName}</span>
                <h2>{plugin.displayName}</h2>
              </div>
              <PluginStatus plugin={plugin} />
            </div>
            <p>{plugin.description}</p>
            <div className="plugin-meta">
              <span>Version {plugin.version}</span>
              <span>{plugin.capabilities.length} capabilities</span>
            </div>
            {plugin.pluginDependencies.length > 0 ? (
              <small>Requires plugins: {plugin.pluginDependencies.join(", ")}</small>
            ) : null}
            <div className="button-row plugin-actions">
              {!plugin.installed ? (
                <button
                  className="primary-button"
                  disabled={busyId === plugin.id}
                  onClick={() => void run(plugin.id, () => installPlugin(plugin.id))}
                  type="button"
                >
                  {busyId === plugin.id ? "Installing…" : "Install"}
                </button>
              ) : null}
              {plugin.installed && !plugin.enabled ? (
                <button
                  className="primary-button"
                  disabled={busyId === plugin.id}
                  onClick={() => void run(plugin.id, () => enablePlugin(plugin.id))}
                  type="button"
                >
                  {busyId === plugin.id ? "Working…" : "Enable"}
                </button>
              ) : null}
              {plugin.installed && plugin.enabled ? (
                <button
                  className="secondary-button"
                  disabled={busyId === plugin.id}
                  onClick={() => void run(plugin.id, () => disablePlugin(plugin.id))}
                  type="button"
                >
                  {busyId === plugin.id ? "Working…" : "Disable"}
                </button>
              ) : null}
              {plugin.installed && !plugin.enabled && !plugin.active ? (
                <button
                  className="danger-button"
                  disabled={busyId === plugin.id}
                  onClick={() => {
                    if (window.confirm(`Uninstall ${plugin.displayName}? Plugin data will be preserved.`)) {
                      void run(plugin.id, () => uninstallPlugin(plugin.id));
                    }
                  }}
                  type="button"
                >
                  Uninstall
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </AdminShell>
  );
}

function PluginStatus({ plugin }: { plugin: PluginRuntimeState }) {
  if (plugin.active) return <span className="plugin-status active">Active</span>;
  if (plugin.installed) return <span className="plugin-status installed">Installed</span>;
  return <span className="plugin-status available">Available</span>;
}
