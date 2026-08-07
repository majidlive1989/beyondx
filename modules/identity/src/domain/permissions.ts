export const IDENTITY_PERMISSIONS = Object.freeze([
  { id: "identity.profile.read", description: "Read the authenticated profile" },
  { id: "identity.profile.update", description: "Update the authenticated profile" },
  { id: "identity.sessions.read", description: "Read personal sessions" },
  { id: "identity.sessions.revoke", description: "Revoke personal sessions" },
  { id: "identity.users.read", description: "Read users" },
  { id: "identity.users.create", description: "Create users" },
  { id: "identity.users.update", description: "Update users" },
  { id: "identity.users.roles.manage", description: "Assign roles to users" },
  { id: "identity.roles.read", description: "Read roles and permissions" },
  { id: "identity.roles.create", description: "Create roles" },
  { id: "identity.roles.update", description: "Update roles" },
  { id: "identity.roles.delete", description: "Delete non-system roles" },
  { id: "identity.sessions.manage", description: "Read and revoke any session" },
  { id: "identity.audit.read", description: "Read identity audit logs" },
] as const);

export type IdentityPermission = (typeof IDENTITY_PERMISSIONS)[number]["id"];

export const DEFAULT_ROLE_NAMES = Object.freeze({
  superAdmin: "SUPER_ADMIN",
  admin: "ADMIN",
  user: "USER",
});
