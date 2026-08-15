import { hash } from "bcryptjs";
import type { Prisma, PrismaClient } from "@prisma/client";

export const PLATFORM_MODULES = Object.freeze([
  "@beyondx/core",
  "@beyondx/events",
  "@beyondx/module-system",
  "@beyondx/module-foundation",
  "@beyondx/module-identity",
  "@beyondx/module-content",
  "@beyondx/module-media",
  "@beyondx/module-schema",
  "@beyondx/module-plugin-manager",
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


export const PLUGIN_MANAGER_SEED_PERMISSIONS = Object.freeze([
  ["plugins.read", "Read installed and available plugins"],
  ["plugins.manage", "Install, enable, disable and uninstall plugins"],
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

  const moduleVersions: Readonly<Record<string, string>> = {
    "@beyondx/module-identity": "0.2.0",
    "@beyondx/module-content": "0.3.0",
    "@beyondx/module-media": "0.3.0",
    "@beyondx/module-schema": "0.4.0",
    "@beyondx/module-plugin-manager": "0.4.0",
  };
  for (const name of PLATFORM_MODULES) {
    const version = moduleVersions[name] ?? "0.1.0";
    await prisma.moduleInstallation.upsert({
      where: { name },
      update: { version, enabled: true },
      create: { name, version, enabled: true },
    });
  }

  const catalogPluginInstallation = await prisma.moduleInstallation.findUnique({
    where: { name: "@beyondx/plugin-catalog" },
  });

  await seedSiteGlobals(prisma);
  await seedCorporateContent(prisma);

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

  for (const [id, description] of PLUGIN_MANAGER_SEED_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { id },
      update: { description, module: "@beyondx/module-plugin-manager" },
      create: { id, description, module: "@beyondx/module-plugin-manager" },
    });
  }

  if (catalogPluginInstallation) {
    for (const [id, description] of CATALOG_SEED_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { id },
        update: { description, module: "@beyondx/plugin-catalog" },
        create: { id, description, module: "@beyondx/plugin-catalog" },
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
  }

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

  const allPermissionIds = [
    ...IDENTITY_SEED_PERMISSIONS,
    ...CONTENT_SEED_PERMISSIONS,
    ...MEDIA_SEED_PERMISSIONS,
    ...SCHEMA_SEED_PERMISSIONS,
    ...PLUGIN_MANAGER_SEED_PERMISSIONS,
    ...(catalogPluginInstallation ? CATALOG_SEED_PERMISSIONS : []),
  ].map(([id]) => id);
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

async function seedSiteGlobals(prisma: PrismaClient): Promise<void> {
  const socialLink = await prisma.dataSchema.upsert({
    where: { key: "site-social-link" },
    update: {
      displayName: "Social link",
      pluralName: "Social links",
      description: "Reusable social/contact link used by site globals",
      kind: "COMPONENT",
      publicRead: false,
      system: true,
    },
    create: {
      key: "site-social-link",
      displayName: "Social link",
      pluralName: "Social links",
      description: "Reusable social/contact link used by site globals",
      kind: "COMPONENT",
      publicRead: false,
      system: true,
    },
  });

  await upsertSeedField(prisma, socialLink.id, {
    key: "platform",
    label: "Platform",
    type: "ENUM",
    required: true,
    position: 10,
    settings: { options: ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "X", "YOUTUBE", "TELEGRAM", "WHATSAPP", "TIKTOK", "GITHUB", "CUSTOM"] },
  });
  await upsertSeedField(prisma, socialLink.id, { key: "label", label: "Label", type: "TEXT", position: 20 });
  await upsertSeedField(prisma, socialLink.id, { key: "url", label: "URL", type: "TEXT", required: true, position: 30 });
  await upsertSeedField(prisma, socialLink.id, { key: "icon", label: "Icon key", type: "TEXT", position: 40 });
  await upsertSeedField(prisma, socialLink.id, { key: "openInNewTab", label: "Open in new tab", type: "BOOLEAN", position: 50 });

  const settings = await prisma.dataSchema.upsert({
    where: { key: "site-settings" },
    update: {
      displayName: "Site settings",
      pluralName: "Site settings",
      description: "Public site-wide identity, contact, media, social and SEO settings",
      kind: "SINGLE",
      publicRead: true,
      system: true,
    },
    create: {
      key: "site-settings",
      displayName: "Site settings",
      pluralName: "Site settings",
      description: "Public site-wide identity, contact, media, social and SEO settings",
      kind: "SINGLE",
      publicRead: true,
      system: true,
    },
  });

  const fields = [
    { key: "siteName", label: "Site name", type: "TEXT", required: true, position: 10 },
    { key: "tagline", label: "Tagline", type: "TEXT", position: 20 },
    { key: "description", label: "Description", type: "LONG_TEXT", position: 30 },
    { key: "email", label: "Email", type: "TEXT", position: 40 },
    { key: "phone", label: "Phone", type: "TEXT", position: 50 },
    { key: "address", label: "Address", type: "LONG_TEXT", position: 60 },
    { key: "companyName", label: "Company name", type: "TEXT", position: 70 },
    { key: "logo", label: "Logo", type: "MEDIA", position: 80 },
    { key: "favicon", label: "Favicon", type: "MEDIA", position: 90 },
    {
      key: "socialLinks",
      label: "Social links",
      type: "COMPONENT",
      repeatable: true,
      position: 100,
      settings: { componentSchemaId: socialLink.id },
    },
    { key: "footerText", label: "Footer text", type: "TEXT", position: 110 },
    { key: "copyrightText", label: "Copyright text", type: "TEXT", position: 120 },
    { key: "defaultLocale", label: "Default locale", type: "TEXT", position: 130 },
    { key: "seoTitle", label: "Default SEO title", type: "TEXT", position: 140 },
    { key: "seoDescription", label: "Default SEO description", type: "LONG_TEXT", position: 150 },
    { key: "seoImage", label: "Default social image", type: "MEDIA", position: 160 },
  ] as const;

  for (const field of fields) await upsertSeedField(prisma, settings.id, field);
}


async function seedCorporateContent(prisma: PrismaClient): Promise<void> {
  const category = await prisma.dataSchema.upsert({
    where: { key: "blog-category" },
    update: {
      displayName: "Blog category",
      pluralName: "Blog categories",
      description: "Categories used by corporate blog posts",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
    create: {
      key: "blog-category",
      displayName: "Blog category",
      pluralName: "Blog categories",
      description: "Categories used by corporate blog posts",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
  });
  await upsertSeedField(prisma, category.id, { key: "name", label: "Name", type: "TEXT", required: true, position: 10 });
  await upsertSeedField(prisma, category.id, { key: "slug", label: "Slug", type: "UID", required: true, position: 20, settings: { targetField: "name" } });
  await upsertSeedField(prisma, category.id, { key: "description", label: "Description", type: "LONG_TEXT", position: 30 });

  const tag = await prisma.dataSchema.upsert({
    where: { key: "blog-tag" },
    update: {
      displayName: "Blog tag",
      pluralName: "Blog tags",
      description: "Tags used by corporate blog posts",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
    create: {
      key: "blog-tag",
      displayName: "Blog tag",
      pluralName: "Blog tags",
      description: "Tags used by corporate blog posts",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
  });
  await upsertSeedField(prisma, tag.id, { key: "name", label: "Name", type: "TEXT", required: true, position: 10 });
  await upsertSeedField(prisma, tag.id, { key: "slug", label: "Slug", type: "UID", required: true, position: 20, settings: { targetField: "name" } });

  const page = await prisma.dataSchema.upsert({
    where: { key: "site-page" },
    update: {
      displayName: "Page",
      pluralName: "Pages",
      description: "Public corporate pages such as Home, About, Contact and Services",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
    create: {
      key: "site-page",
      displayName: "Page",
      pluralName: "Pages",
      description: "Public corporate pages such as Home, About, Contact and Services",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
  });
  const pageFields: readonly SeedFieldInput[] = [
    { key: "title", label: "Title", type: "TEXT", required: true, position: 10 },
    { key: "slug", label: "Slug", type: "UID", required: true, position: 20, settings: { targetField: "title" } },
    { key: "excerpt", label: "Excerpt", type: "LONG_TEXT", position: 30 },
    { key: "content", label: "Content", type: "RICH_TEXT", position: 40 },
    { key: "featuredImage", label: "Featured image", type: "MEDIA", position: 50 },
    { key: "template", label: "Template", type: "ENUM", position: 60, settings: { options: ["DEFAULT", "FULL_WIDTH", "LANDING"] } },
    { key: "sortOrder", label: "Sort order", type: "NUMBER", position: 70 },
    { key: "locale", label: "Locale", type: "TEXT", position: 80 },
    { key: "seoTitle", label: "SEO title", type: "TEXT", position: 90 },
    { key: "seoDescription", label: "SEO description", type: "LONG_TEXT", position: 100 },
    { key: "ogImage", label: "OG image", type: "MEDIA", position: 110 },
    { key: "canonicalUrl", label: "Canonical URL", type: "TEXT", position: 120 },
    { key: "noIndex", label: "No index", type: "BOOLEAN", position: 130 },
  ];
  for (const field of pageFields) await upsertSeedField(prisma, page.id, field);

  const post = await prisma.dataSchema.upsert({
    where: { key: "blog-post" },
    update: {
      displayName: "Blog post",
      pluralName: "Blog posts",
      description: "Public corporate blog posts",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
    create: {
      key: "blog-post",
      displayName: "Blog post",
      pluralName: "Blog posts",
      description: "Public corporate blog posts",
      kind: "COLLECTION",
      publicRead: true,
      system: true,
    },
  });
  const postFields: readonly SeedFieldInput[] = [
    { key: "title", label: "Title", type: "TEXT", required: true, position: 10 },
    { key: "slug", label: "Slug", type: "UID", required: true, position: 20, settings: { targetField: "title" } },
    { key: "excerpt", label: "Excerpt", type: "LONG_TEXT", position: 30 },
    { key: "content", label: "Content", type: "RICH_TEXT", position: 40 },
    { key: "featuredImage", label: "Featured image", type: "MEDIA", position: 50 },
    { key: "category", label: "Category", type: "RELATION", position: 60, relationTargetSchemaId: category.id },
    { key: "tags", label: "Tags", type: "RELATION", repeatable: true, position: 70, relationTargetSchemaId: tag.id },
    { key: "authorName", label: "Author name", type: "TEXT", position: 80 },
    { key: "publishedAt", label: "Published at", type: "DATE", position: 90 },
    { key: "locale", label: "Locale", type: "TEXT", position: 100 },
    { key: "isFeatured", label: "Featured post", type: "BOOLEAN", position: 110 },
    { key: "seoTitle", label: "SEO title", type: "TEXT", position: 120 },
    { key: "seoDescription", label: "SEO description", type: "LONG_TEXT", position: 130 },
    { key: "ogImage", label: "OG image", type: "MEDIA", position: 140 },
    { key: "canonicalUrl", label: "Canonical URL", type: "TEXT", position: 150 },
    { key: "noIndex", label: "No index", type: "BOOLEAN", position: 160 },
  ];
  for (const field of postFields) await upsertSeedField(prisma, post.id, field);
}

interface SeedFieldInput {
  key: string;
  label: string;
  type: "TEXT" | "LONG_TEXT" | "RICH_TEXT" | "UID" | "NUMBER" | "BOOLEAN" | "DATE" | "ENUM" | "MEDIA" | "RELATION" | "COMPONENT";
  required?: boolean;
  repeatable?: boolean;
  position: number;
  settings?: Prisma.InputJsonValue;
  relationTargetSchemaId?: string;
}

async function upsertSeedField(prisma: PrismaClient, schemaId: string, field: SeedFieldInput): Promise<void> {
  const data = {
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    repeatable: field.repeatable ?? false,
    position: field.position,
    ...(field.settings === undefined ? {} : { settings: field.settings }),
    ...(field.relationTargetSchemaId === undefined ? {} : { relationTargetSchemaId: field.relationTargetSchemaId }),
  };
  await prisma.dataField.upsert({
    where: { schemaId_key: { schemaId, key: field.key } },
    update: data,
    create: { schemaId, key: field.key, ...data },
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
