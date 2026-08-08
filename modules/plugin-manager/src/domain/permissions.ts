export const PLUGIN_MANAGER_PERMISSIONS = Object.freeze([
  { id: "plugins.read", description: "Read installed and available plugins" },
  { id: "plugins.manage", description: "Install, enable, disable and uninstall plugins" },
] as const);
