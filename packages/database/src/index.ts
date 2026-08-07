import { PrismaClient } from "@prisma/client";
let client: PrismaClient | undefined;
export function getDatabaseClient(): PrismaClient { client ??= new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] }); return client; }
export async function checkDatabaseConnection(database: PrismaClient = getDatabaseClient()): Promise<number> { const started = performance.now(); await database.$queryRaw`SELECT 1`; return Math.round((performance.now() - started) * 100) / 100; }
export async function disconnectDatabase(): Promise<void> { if (client) { await client.$disconnect(); client = undefined; } }
export { Prisma, PrismaClient } from "@prisma/client";
export type {
  AuditLog,
  EmailVerificationToken,
  ModuleInstallation,
  PasswordResetToken,
  Permission,
  PlatformMetadata,
  Role,
  RolePermission,
  Session,
  User,
  UserRole,
  UserStatus,
} from "@prisma/client";
