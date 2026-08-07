import { Prisma, type PrismaClient, type Session as PrismaSession } from "@beyondx/database";
import { AppError } from "@beyondx/core";
import type {
  CreateAuditRecordInput,
  CreateSessionRecordInput,
  CreateUserRecordInput,
  IdentityRepository,
  OneTimeTokenKind,
  UpdateUserRecordInput,
} from "../application/contracts.js";
import type {
  IdentityAuditLog,
  IdentityRole,
  IdentitySession,
  IdentityUser,
  Page,
  PaginationInput,
  UserStatus,
} from "../domain/models.js";

const roleInclude = {
  permissions: { include: { permission: true } },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: typeof roleInclude;
}>;

const userInclude = {
  roles: {
    include: {
      role: { include: roleInclude },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAccess = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

const sessionInclude = {
  user: { include: userInclude },
} satisfies Prisma.SessionInclude;

type SessionWithUser = Prisma.SessionGetPayload<{
  include: typeof sessionInclude;
}>;

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly database: PrismaClient) {}

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    const user = await this.database.user.findUnique({ where: { email }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async findUserById(id: string): Promise<IdentityUser | null> {
    const user = await this.database.user.findUnique({ where: { id }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async createUser(input: CreateUserRecordInput): Promise<IdentityUser> {
    try {
      const user = await this.database.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          ...(input.emailVerifiedAt === undefined
            ? {}
            : { emailVerifiedAt: input.emailVerifiedAt }),
          roles: {
            create: input.roleNames.map((name) => ({ role: { connect: { name } } })),
          },
        },
        include: userInclude,
      });
      return mapUser(user);
    } catch (error) {
      throw mapPrismaConflict(error, "IDENTITY_USER_CREATE_FAILED", "Unable to create user");
    }
  }

  async updateUser(id: string, input: UpdateUserRecordInput): Promise<IdentityUser> {
    try {
      const user = await this.database.user.update({
        where: { id },
        data: input,
        include: userInclude,
      });
      return mapUser(user);
    } catch (error) {
      throw mapPrismaConflict(error, "IDENTITY_USER_UPDATE_FAILED", "Unable to update user");
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.database.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async recordFailedLogin(
    userId: string,
    failedAttempts: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.database.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: failedAttempts, lockedUntil },
    });
  }

  async recordSuccessfulLogin(userId: string, at: Date): Promise<void> {
    await this.database.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: at,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async markEmailVerified(userId: string, at: Date): Promise<void> {
    await this.database.user.update({ where: { id: userId }, data: { emailVerifiedAt: at } });
  }

  async createSession(input: CreateSessionRecordInput): Promise<IdentitySession> {
    const session = await this.database.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: input.refreshTokenHash,
        familyId: input.familyId,
        expiresAt: input.expiresAt,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
      },
    });
    return mapSession(session);
  }

  async findSessionById(id: string): Promise<IdentitySession | null> {
    const session = await this.database.session.findUnique({ where: { id } });
    return session ? mapSession(session) : null;
  }

  async findSessionByRefreshTokenHash(hash: string): Promise<IdentitySession | null> {
    const session = await this.database.session.findUnique({
      where: { refreshTokenHash: hash },
      include: sessionInclude,
    });
    return session ? mapSessionWithUser(session) : null;
  }

  async rotateSession(
    currentSessionId: string,
    replacement: CreateSessionRecordInput,
    at: Date,
  ): Promise<IdentitySession> {
    return this.database.$transaction(async (transaction) => {
      const current = await transaction.session.updateMany({
        where: { id: currentSessionId, revokedAt: null },
        data: { revokedAt: at, lastUsedAt: at },
      });
      if (current.count !== 1) {
        throw new AppError({
          code: "IDENTITY_SESSION_ROTATION_CONFLICT",
          message: "Session was already rotated or revoked",
          statusCode: 409,
        });
      }
      const created = await transaction.session.create({
        data: {
          userId: replacement.userId,
          refreshTokenHash: replacement.refreshTokenHash,
          familyId: replacement.familyId,
          expiresAt: replacement.expiresAt,
          userAgent: replacement.userAgent ?? null,
          ipAddress: replacement.ipAddress ?? null,
        },
      });
      await transaction.session.update({
        where: { id: currentSessionId },
        data: { replacedBySessionId: created.id },
      });
      return mapSession(created);
    });
  }

  async revokeSession(sessionId: string, at: Date): Promise<void> {
    await this.database.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeSessionByRefreshHash(hash: string, at: Date): Promise<void> {
    await this.database.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: at },
    });
  }

  async revokeAllUserSessions(userId: string, at: Date): Promise<number> {
    const result = await this.database.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: at },
    });
    return result.count;
  }

  async revokeSessionFamily(familyId: string, at: Date): Promise<number> {
    const result = await this.database.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: at },
    });
    return result.count;
  }

  async listUserSessions(userId: string): Promise<IdentitySession[]> {
    const sessions = await this.database.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return sessions.map(mapSession);
  }

  async listSessions(
    input: PaginationInput & { userId?: string },
  ): Promise<Page<IdentitySession>> {
    const where = input.userId ? { userId: input.userId } : {};
    const [items, total] = await this.database.$transaction([
      this.database.session.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.session.count({ where }),
    ]);
    return page(items.map(mapSession), input, total);
  }

  async createOneTimeToken(
    kind: OneTimeTokenKind,
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    if (kind === "email-verification") {
      await this.database.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt },
      });
      return;
    }
    await this.database.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async consumeOneTimeToken(
    kind: OneTimeTokenKind,
    tokenHash: string,
    at: Date,
  ): Promise<{ userId: string } | null> {
    return this.database.$transaction(async (transaction) => {
      if (kind === "email-verification") {
        const token = await transaction.emailVerificationToken.findUnique({
          where: { tokenHash },
          select: { id: true, userId: true, expiresAt: true, usedAt: true },
        });
        if (!token || token.usedAt || token.expiresAt <= at) return null;
        const updated = await transaction.emailVerificationToken.updateMany({
          where: { id: token.id, usedAt: null, expiresAt: { gt: at } },
          data: { usedAt: at },
        });
        return updated.count === 1 ? { userId: token.userId } : null;
      }

      const token = await transaction.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      });
      if (!token || token.usedAt || token.expiresAt <= at) return null;
      const updated = await transaction.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: at } },
        data: { usedAt: at },
      });
      return updated.count === 1 ? { userId: token.userId } : null;
    });
  }

  async invalidateOneTimeTokens(
    kind: OneTimeTokenKind,
    userId: string,
    at: Date,
  ): Promise<void> {
    if (kind === "email-verification") {
      await this.database.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: at },
      });
      return;
    }
    await this.database.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: at },
    });
  }

  async listUsers(
    input: PaginationInput & { search?: string; status?: UserStatus },
  ): Promise<Page<IdentityUser>> {
    const where: Prisma.UserWhereInput = {};
    if (input.status !== undefined) {
      where.status = input.status;
    }
    if (input.search !== undefined && input.search.length > 0) {
      where.OR = [
        { email: { contains: input.search, mode: "insensitive" } },
        { firstName: { contains: input.search, mode: "insensitive" } },
        { lastName: { contains: input.search, mode: "insensitive" } },
      ];
    }
    const [items, total] = await this.database.$transaction([
      this.database.user.findMany({
        where,
        include: userInclude,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.user.count({ where }),
    ]);
    return page(items.map(mapUser), input, total);
  }

  async assignUserRoles(userId: string, roleIds: string[]): Promise<IdentityUser> {
    return this.database.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { userId } });
      if (roleIds.length) {
        await transaction.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId })),
          skipDuplicates: true,
        });
      }
      const user = await transaction.user.findUnique({ where: { id: userId }, include: userInclude });
      if (!user) throw userNotFound();
      return mapUser(user);
    });
  }

  async listRoles(): Promise<IdentityRole[]> {
    const roles = await this.database.role.findMany({
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
    return roles.map(mapRole);
  }

  async findRoleById(id: string): Promise<IdentityRole | null> {
    const role = await this.database.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    return role ? mapRole(role) : null;
  }

  async createRole(input: {
    name: string;
    description?: string | null;
    permissionIds: string[];
  }): Promise<IdentityRole> {
    try {
      const role = await this.database.role.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          permissions: {
            create: input.permissionIds.map((permissionId) => ({
              permission: { connect: { id: permissionId } },
            })),
          },
        },
        include: { permissions: { include: { permission: true } } },
      });
      return mapRole(role);
    } catch (error) {
      throw mapPrismaConflict(error, "IDENTITY_ROLE_CREATE_FAILED", "Unable to create role");
    }
  }

  async updateRole(
    id: string,
    input: { name?: string; description?: string | null; permissionIds?: string[] },
  ): Promise<IdentityRole> {
    try {
      return this.database.$transaction(async (transaction) => {
        if (input.permissionIds) {
          await transaction.rolePermission.deleteMany({ where: { roleId: id } });
          if (input.permissionIds.length) {
            await transaction.rolePermission.createMany({
              data: input.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
              skipDuplicates: true,
            });
          }
        }
        const role = await transaction.role.update({
          where: { id },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.description === undefined ? {} : { description: input.description }),
          },
          include: { permissions: { include: { permission: true } } },
        });
        return mapRole(role);
      });
    } catch (error) {
      throw mapPrismaConflict(error, "IDENTITY_ROLE_UPDATE_FAILED", "Unable to update role");
    }
  }

  async deleteRole(id: string): Promise<void> {
    await this.database.role.delete({ where: { id } });
  }

  listPermissions(): Promise<Array<{ id: string; description: string; module: string }>> {
    return this.database.permission.findMany({ orderBy: [{ module: "asc" }, { id: "asc" }] });
  }

  async createAuditLog(input: CreateAuditRecordInput): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async listAuditLogs(input: PaginationInput): Promise<Page<IdentityAuditLog>> {
    const [items, total] = await this.database.$transaction([
      this.database.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.database.auditLog.count(),
    ]);
    return page(
      items.map((item) => ({
        ...item,
        metadata: isRecord(item.metadata) ? item.metadata : null,
      })),
      input,
      total,
    );
  }
}

function mapUser(user: UserWithAccess): IdentityUser {
  const roles = user.roles.map((item) => mapRole(item.role));
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: user.lockedUntil,
    roles,
    permissions: [...new Set(roles.flatMap((role) => role.permissions))],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapRole(role: RoleWithPermissions): IdentityRole {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    system: role.system,
    permissions: role.permissions.map((item) => item.permission.id).sort(),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

function mapSession(session: PrismaSession): IdentitySession {
  return {
    id: session.id,
    userId: session.userId,
    refreshTokenHash: session.refreshTokenHash,
    familyId: session.familyId,
    expiresAt: session.expiresAt,
    revokedAt: session.revokedAt,
    replacedBySessionId: session.replacedBySessionId,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    lastUsedAt: session.lastUsedAt,
    createdAt: session.createdAt,
  };
}

function mapSessionWithUser(session: SessionWithUser): IdentitySession {
  return { ...mapSession(session), user: mapUser(session.user) };
}

function page<T>(items: T[], input: PaginationInput, total: number): Page<T> {
  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    total,
    pageCount: Math.ceil(total / input.pageSize),
  };
}

function mapPrismaConflict(error: unknown, code: string, message: string): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new AppError({
        code: "IDENTITY_UNIQUE_CONSTRAINT_VIOLATION",
        message: "A unique identity value is already in use",
        statusCode: 409,
        details: { target: error.meta?.target ?? null },
        cause: error,
      });
    }
    if (error.code === "P2025") return userNotFound();
  }
  return new AppError({ code, message, statusCode: 500, cause: error });
}

function userNotFound(): AppError {
  return new AppError({
    code: "IDENTITY_USER_NOT_FOUND",
    message: "User was not found",
    statusCode: 404,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
