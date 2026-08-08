import { hash } from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

export const PLATFORM_MODULES = Object.freeze([
  "@beyondx/core",
  "@beyondx/events",
  "@beyondx/module-system",
  "@beyondx/module-foundation",
  "@beyondx/module-identity",
  "@beyondx/module-content",
  "@beyondx/module-media",
  "@beyondx/module-schema",
  "@beyondx/module-catalog",
] as const);

export const IDENTITY_SEED_PERMISSIONS = Object.freeze([
  ["identity.profile.read", "Read the authenticated profile"],
  ["identity.profile.update", "Update the authenticated profile"],
  ["identity.sessions.read", "Read personal sessions"],
  ["identity.sessions.revoke", "Revoke personal sessions"],
  ["identity.users.read", "Read users"],
  ["identity.users.create", "Create users"],
  ["identity.users.update", "Update users"],
  ["identity.users.roles.manage", "Assign roles to users"],
  ["identity.roles.read", "Read roles and permissions"],
  ["identity.roles.create", "Create roles"],
  ["identity.roles.update", "Update roles"],
  ["identity.roles.delete", "Delete non-system roles"],
  ["identity.sessions.manage", "Read and revoke any session"],
  ["identity.audit.read", "Read identity audit logs"],
] as const);

export const CONTENT_SEED_PERMISSIONS = Object.freeze([
  ["content.types.read", "Read content types and field definitions"],
  ["content.types.create", "Create content types"],
  ["content.types.update", "Update content types and field definitions"],
  ["content.types.delete", "Delete unused content types"],
  ["content.entries.read", "Read CMS entries"],
  ["content.entries.create", "Create CMS entries"],
  ["content.entries.update", "Update CMS entries"],
  ["content.entries.delete", "Delete CMS entries"],
  ["content.entries.publish", "Publish, unpublish and schedule CMS entries"],
  ["content.entries.archive", "Archive CMS entries"],
  ["content.revisions.read", "Read CMS revision history"],
] as const);

export const MEDIA_SEED_PERMISSIONS = Object.freeze([
  ["media.assets.read", "Read media assets and file content"],
  ["media.assets.upload", "Upload media assets"],
  ["media.assets.update", "Update media metadata and image accessibility text"],
  ["media.assets.delete", "Delete media assets"],
] as const);


export const SCHEMA_SEED_PERMISSIONS = Object.freeze([
  ["schema.builder.read", "Read dynamic schemas and field definitions"],
  ["schema.builder.manage", "Create and modify dynamic schemas and fields"],
  ["schema.records.read", "Read dynamic records"],
  ["schema.records.create", "Create dynamic records"],
  ["schema.records.update", "Update dynamic records and system extensions"],
  ["schema.records.delete", "Delete dynamic records"],
] as const);

export const CATALOG_SEED_PERMISSIONS = Object.freeze([
  ["catalog.products.read", "Read catalog products and variants"],
  ["catalog.products.create", "Create catalog products"],
  ["catalog.products.update", "Update catalog products and publication status"],
  ["catalog.products.delete", "Delete catalog products"],
  ["catalog.variants.manage", "Create, update and delete product variants and SKUs"],
  ["catalog.categories.manage", "Manage catalog categories"],
  ["catalog.brands.manage", "Manage catalog brands"],
  ["catalog.attributes.manage", "Manage catalog attributes and values"],
] as const);

export async function seedDatabase(
  prisma: PrismaClient,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const adminEmail = required(environment, "ADMIN_EMAIL").trim().toLowerCase();
  const adminPassword = required(environment, "ADMIN_PASSWORD");
  const adminFirstName = required(environment, "ADMIN_FIRST_NAME");
  const adminLastName = required(environment, "ADMIN_LAST_NAME");
  const rounds = Number(environment.PASSWORD_SALT_ROUNDS ?? "12");
  if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
    throw new Error("PASSWORD_SALT_ROUNDS must be an integer between 10 and 15");
  }
  const adminPasswordHash = await hash(adminPassword, rounds);

  await prisma.platformMetadata.upsert({
    where: { key: "platform.identity" },
    update: {
      value: { name: "BeyondX", slogan: "Build Any Digital Product", phase: 3 },
    },
    create: {
      key: "platform.identity",
      value: { name: "BeyondX", slogan: "Build Any Digital Product", phase: 3 },
    },
  });

  for (const name of PLATFORM_MODULES) {
    await prisma.moduleInstallation.upsert({
      where: { name },
      update: {
        version: ["@beyondx/module-catalog", "@beyondx/module-schema"].includes(name) ? "0.4.0" : ["@beyondx/module-content", "@beyondx/module-media"].includes(name) ? "0.3.0" : name === "@beyondx/module-identity" ? "0.2.0" : "0.1.0",
        enabled: true,
      },
      create: {
        name,
        version: ["@beyondx/module-catalog", "@beyondx/module-schema"].includes(name) ? "0.4.0" : ["@beyondx/module-content", "@beyondx/module-media"].includes(name) ? "0.3.0" : name === "@beyondx/module-identity" ? "0.2.0" : "0.1.0",
        enabled: true,
      },
    });
  }

  for (const [id, description] of IDENTITY_SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: { description, module: "@beyondx/module-identity" },
      create: { id, description, module: "@beyondx/module-identity" },
    });
  }

  for (const [id, description] of CONTENT_SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: { description, module: "@beyondx/module-content" },
      create: { id, description, module: "@beyondx/module-content" },
    });
  }

  for (const [id, description] of MEDIA_SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: { description, module: "@beyondx/module-media" },
      create: { id, description, module: "@beyondx/module-media" },
    });
  }

  for (const [id, description] of SCHEMA_SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: { description, module: "@beyondx/module-schema" },
      create: { id, description, module: "@beyondx/module-schema" },
    });
  }

  for (const [id, description] of CATALOG_SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: { description, module: "@beyondx/module-catalog" },
      create: { id, description, module: "@beyondx/module-catalog" },
    });
  }

  await prisma.dataSchema.upsert({
    where: { key: "catalog.product" },
    update: { displayName: "Product custom fields", pluralName: "Product custom fields", kind: "SYSTEM_EXTENSION", system: true, publicRead: false },
    create: { key: "catalog.product", displayName: "Product custom fields", pluralName: "Product custom fields", description: "Schema-driven fields attached to catalog products", kind: "SYSTEM_EXTENSION", system: true, publicRead: false },
  });
  await prisma.dataSchema.upsert({
    where: { key: "catalog.variant" },
    update: { displayName: "Variant custom fields", pluralName: "Variant custom fields", kind: "SYSTEM_EXTENSION", system: true, publicRead: false },
    create: { key: "catalog.variant", displayName: "Variant custom fields", pluralName: "Variant custom fields", description: "Schema-driven fields attached to catalog variants", kind: "SYSTEM_EXTENSION", system: true, publicRead: false },
  });

  const superAdmin = await prisma.role.upsert({
    where: { name: "SUPER_ADMIN" },
    update: { description: "Full platform access", system: true },
    create: { name: "SUPER_ADMIN", description: "Full platform access", system: true },
  });
  const admin = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: { description: "Administrative platform access", system: true },
    create: { name: "ADMIN", description: "Administrative platform access", system: true },
  });
  const userRole = await prisma.role.upsert({
    where: { name: "USER" },
    update: { description: "Default authenticated user", system: true },
    create: { name: "USER", description: "Default authenticated user", system: true },
  });

  const allPermissionIds = [...IDENTITY_SEED_PERMISSIONS, ...CONTENT_SEED_PERMISSIONS, ...MEDIA_SEED_PERMISSIONS, ...SCHEMA_SEED_PERMISSIONS, ...CATALOG_SEED_PERMISSIONS].map(([id]) => id);
  const adminPermissionIds = allPermissionIds.filter(
    (id) => !["identity.roles.delete", "identity.audit.read"].includes(id),
  );
  const userPermissionIds = allPermissionIds.filter((id) =>
    [
      "identity.profile.read",
      "identity.profile.update",
      "identity.sessions.read",
      "identity.sessions.revoke",
    ].includes(id),
  );
  await syncRolePermissions(prisma, superAdmin.id, allPermissionIds);
  await syncRolePermissions(prisma, admin.id, adminPermissionIds);
  await syncRolePermissions(prisma, userRole.id, userPermissionIds);

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const adminUser = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          firstName: adminFirstName,
          lastName: adminLastName,
          status: "ACTIVE",
          passwordHash: adminPasswordHash,
          emailVerifiedAt: existingAdmin.emailVerifiedAt ?? new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash: adminPasswordHash,
          firstName: adminFirstName,
          lastName: adminLastName,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdmin.id } },
    update: {},
    create: { userId: adminUser.id, roleId: superAdmin.id },
  });
}

async function syncRolePermissions(
  prisma: PrismaClient,
  roleId: string,
  permissionIds: readonly string[],
): Promise<void> {
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (!value) throw new Error(`Required environment variable is missing: ${name}`);
  return value;
}
