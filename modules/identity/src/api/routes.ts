import { AppError, type HttpRequestContext, type HttpRouteDefinition } from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type { IdentityService } from "../application/identity-service.js";
import { toPublicUser, type IdentityRole, type IdentitySession } from "../domain/models.js";

type RefreshBody = { refreshToken?: string };
type UpdateProfileBody = { firstName?: string; lastName?: string };
type PaginationQuery = { page: number; pageSize: number };
type UsersQuery = PaginationQuery & {
  search?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DISABLED";
};
type SessionsQuery = PaginationQuery & { userId?: string };
type CreateUserBody = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleIds: string[];
  status?: "ACTIVE" | "SUSPENDED" | "DISABLED";
  emailVerified?: boolean;
};
type UpdateUserBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
  status?: "ACTIVE" | "SUSPENDED" | "DISABLED";
};
type RoleBody = {
  name: string;
  description?: string | null;
  permissionIds: string[];
};
type RoleUpdateBody = {
  name?: string;
  description?: string | null;
  permissionIds?: string[];
};

const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: passwordSchema,
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(128),
});

const refreshSchema = z
  .object({ refreshToken: z.string().min(20).optional() })
  .default({})
  .transform(
    (value): RefreshBody =>
      value.refreshToken === undefined ? {} : { refreshToken: value.refreshToken },
  );

const emailSchema = z.object({ email: z.string().email().max(320) });
const tokenSchema = z.object({ token: z.string().min(20) });
const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
  })
  .refine((value) => value.firstName !== undefined || value.lastName !== undefined, {
    message: "At least one profile field is required",
  })
  .transform(
    (value): UpdateProfileBody => ({
      ...(value.firstName === undefined ? {} : { firstName: value.firstName }),
      ...(value.lastName === undefined ? {} : { lastName: value.lastName }),
    }),
  );

const idParamsSchema = z.object({ id: z.string().min(1) });

const paginationSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .transform((value): PaginationQuery => value);

const usersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  })
  .transform(
    (value): UsersQuery => ({
      page: value.page,
      pageSize: value.pageSize,
      ...(value.search === undefined ? {} : { search: value.search }),
      ...(value.status === undefined ? {} : { status: value.status }),
    }),
  );

const sessionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    userId: z.string().min(1).optional(),
  })
  .transform(
    (value): SessionsQuery => ({
      page: value.page,
      pageSize: value.pageSize,
      ...(value.userId === undefined ? {} : { userId: value.userId }),
    }),
  );

const createUserSchema = z
  .object({
    email: z.string().email().max(320),
    password: passwordSchema,
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    roleIds: z.array(z.string().min(1)).default([]),
    status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
    emailVerified: z.boolean().optional(),
  })
  .transform(
    (value): CreateUserBody => ({
      email: value.email,
      password: value.password,
      firstName: value.firstName,
      lastName: value.lastName,
      roleIds: value.roleIds,
      ...(value.status === undefined ? {} : { status: value.status }),
      ...(value.emailVerified === undefined
        ? {}
        : { emailVerified: value.emailVerified }),
    }),
  );

const updateUserSchema = z
  .object({
    email: z.string().email().max(320).optional(),
    firstName: z.string().trim().min(1).max(80).optional(),
    lastName: z.string().trim().min(1).max(80).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED"]).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  })
  .transform(
    (value): UpdateUserBody => ({
      ...(value.email === undefined ? {} : { email: value.email }),
      ...(value.firstName === undefined ? {} : { firstName: value.firstName }),
      ...(value.lastName === undefined ? {} : { lastName: value.lastName }),
      ...(value.status === undefined ? {} : { status: value.status }),
    }),
  );

const assignRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)).max(100),
});

const roleInputSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).nullable().optional(),
    permissionIds: z.array(z.string().min(3)).max(200),
  })
  .transform(
    (value): RoleBody => ({
      name: value.name,
      permissionIds: value.permissionIds,
      ...(value.description === undefined
        ? {}
        : { description: value.description }),
    }),
  );

const roleUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    permissionIds: z.array(z.string().min(3)).max(200).optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  })
  .transform(
    (value): RoleUpdateBody => ({
      ...(value.name === undefined ? {} : { name: value.name }),
      ...(value.description === undefined
        ? {}
        : { description: value.description }),
      ...(value.permissionIds === undefined
        ? {}
        : { permissionIds: value.permissionIds }),
    }),
  );

export function createIdentityRoutes(service: IdentityService): HttpRouteDefinition[] {
  return [
    publicRoute("POST", "/api/v1/auth/register", "Register account", async (context) => {
      const result = await service.register(parseInput(registerSchema, context.body), metadata(context));
      return authResponse(service, result, 201);
    }, { body: registerBodySchema, response: { 201: authResponseSchema } }),

    publicRoute("POST", "/api/v1/auth/login", "Log in", async (context) => {
      const result = await service.login(parseInput(loginSchema, context.body), metadata(context));
      return authResponse(service, result, 200);
    }, { body: loginBodySchema, response: { 200: authResponseSchema } }),

    publicRoute("POST", "/api/v1/auth/refresh", "Rotate refresh token", async (context) => {
      const body = parseInput(refreshSchema, context.body ?? {});
      const refreshToken = body.refreshToken ?? readCookie(context, service.refreshCookieName());
      if (!refreshToken) throw missingRefreshToken();
      const result = await service.refresh(refreshToken, metadata(context));
      return authResponse(service, result, 200);
    }, { body: { type: "object", properties: { refreshToken: { type: "string" } } }, response: { 200: authResponseSchema } }),

    protectedRoute("POST", "/api/v1/auth/logout", "Log out current session", "identity.sessions.revoke", async (context) => {
      const userId = principalId(context);
      await service.logout(readCookie(context, service.refreshCookieName()), userId, metadata(context));
      return { statusCode: 204, headers: { "set-cookie": service.clearRefreshCookie() }, body: null };
    }),

    protectedRoute("POST", "/api/v1/auth/logout-all", "Revoke all personal sessions", "identity.sessions.revoke", async (context) => {
      const revokedSessions = await service.logoutAll(principalId(context), metadata(context));
      return { headers: { "set-cookie": service.clearRefreshCookie() }, body: { revokedSessions } };
    }),

    protectedRoute("GET", "/api/v1/auth/me", "Read authenticated profile", "identity.profile.read", async (context) => ({
      body: { user: await service.me(principalId(context)) },
    })),

    protectedRoute("PATCH", "/api/v1/auth/me", "Update authenticated profile", "identity.profile.update", async (context) => ({
      body: {
        user: await service.updateProfile(
          principalId(context),
          parseInput(updateProfileSchema, context.body),
          metadata(context),
        ),
      },
    }), { body: profileBodySchema }),

    protectedRoute("GET", "/api/v1/auth/sessions", "List personal sessions", "identity.sessions.read", async (context) => ({
      body: { sessions: (await service.listUserSessions(principalId(context))).map(publicSession) },
    })),

    protectedRoute("DELETE", "/api/v1/auth/sessions/:id", "Revoke a personal session", "identity.sessions.revoke", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      await service.revokeOwnSession(principalId(context), id, metadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    publicRoute("POST", "/api/v1/auth/email/verification/request", "Request email verification", async (context) => {
      await service.requestEmailVerification(parseInput(emailSchema, context.body).email);
      return { statusCode: 202, body: { message: "If verification is required, an email has been sent" } };
    }, { body: emailBodySchema }),

    publicRoute("POST", "/api/v1/auth/email/verify", "Verify email address", async (context) => {
      await service.verifyEmail(parseInput(tokenSchema, context.body).token, metadata(context));
      return { body: { verified: true } };
    }, { body: tokenBodySchema }),

    publicRoute("POST", "/api/v1/auth/password/forgot", "Request password reset", async (context) => {
      await service.requestPasswordReset(parseInput(emailSchema, context.body).email);
      return { statusCode: 202, body: { message: "If the account exists, a password reset email has been sent" } };
    }, { body: emailBodySchema }),

    publicRoute("POST", "/api/v1/auth/password/reset", "Reset password", async (context) => {
      const input = parseInput(resetPasswordSchema, context.body);
      await service.resetPassword(input.token, input.password, metadata(context));
      return { body: { reset: true } };
    }, { body: resetPasswordBodySchema }),

    protectedRoute("GET", "/api/v1/admin/users", "List users", "identity.users.read", async (context) => {
      const result = await service.listUsers(parseInput(usersQuerySchema, context.query));
      return { body: { ...result, items: result.items.map(toPublicUser) } };
    }, { querystring: usersQueryJsonSchema }),

    protectedRoute("POST", "/api/v1/admin/users", "Create user", "identity.users.create", async (context) => ({
      statusCode: 201,
      body: {
        user: await service.createUser(
          principalId(context),
          parseInput(createUserSchema, context.body),
          metadata(context),
        ),
      },
    }), { body: createUserBodySchema }),

    protectedRoute("GET", "/api/v1/admin/users/:id", "Read user", "identity.users.read", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return { body: { user: await service.me(id) } };
    }, { params: idParamsJsonSchema }),

    protectedRoute("PATCH", "/api/v1/admin/users/:id", "Update user", "identity.users.update", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return {
        body: {
          user: await service.updateUser(
            principalId(context),
            id,
            parseInput(updateUserSchema, context.body),
            metadata(context),
          ),
        },
      };
    }, { params: idParamsJsonSchema, body: updateUserBodySchema }),

    protectedRoute("PUT", "/api/v1/admin/users/:id/roles", "Assign user roles", "identity.users.roles.manage", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      const { roleIds } = parseInput(assignRolesSchema, context.body);
      return {
        body: {
          user: await service.assignRoles(principalId(context), id, roleIds, metadata(context)),
        },
      };
    }, { params: idParamsJsonSchema, body: roleIdsBodySchema }),

    protectedRoute("GET", "/api/v1/admin/roles", "List roles", "identity.roles.read", async () => ({
      body: { roles: (await service.listRoles()).map(publicRole) },
    })),

    protectedRoute("POST", "/api/v1/admin/roles", "Create role", "identity.roles.create", async (context) => ({
      statusCode: 201,
      body: {
        role: publicRole(
          await service.createRole(
            principalId(context),
            parseInput(roleInputSchema, context.body),
            metadata(context),
          ),
        ),
      },
    }), { body: roleBodySchema }),

    protectedRoute("PATCH", "/api/v1/admin/roles/:id", "Update role", "identity.roles.update", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      return {
        body: {
          role: publicRole(
            await service.updateRole(
              principalId(context),
              id,
              parseInput(roleUpdateSchema, context.body),
              metadata(context),
            ),
          ),
        },
      };
    }, { params: idParamsJsonSchema, body: roleUpdateBodySchema }),

    protectedRoute("DELETE", "/api/v1/admin/roles/:id", "Delete role", "identity.roles.delete", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      await service.deleteRole(principalId(context), id, metadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/permissions", "List permissions", "identity.roles.read", async () => ({
      body: { permissions: await service.listPermissions() },
    })),

    protectedRoute("GET", "/api/v1/admin/sessions", "List sessions", "identity.sessions.manage", async (context) => {
      const result = await service.listSessions(parseInput(sessionsQuerySchema, context.query));
      return { body: { ...result, items: result.items.map(publicSession) } };
    }, { querystring: sessionsQueryJsonSchema }),

    protectedRoute("DELETE", "/api/v1/admin/sessions/:id", "Revoke any session", "identity.sessions.manage", async (context) => {
      const { id } = parseInput(idParamsSchema, context.params);
      await service.revokeAnySession(principalId(context), id, metadata(context));
      return { statusCode: 204, body: null };
    }, { params: idParamsJsonSchema }),

    protectedRoute("GET", "/api/v1/admin/audit-logs", "List identity audit logs", "identity.audit.read", async (context) => ({
      body: await service.listAuditLogs(parseInput(paginationSchema, context.query)),
    }), { querystring: paginationJsonSchema }),
  ];
}

type Handler = HttpRouteDefinition["handler"];

function publicRoute(
  method: HttpRouteDefinition["method"],
  path: string,
  summary: string,
  handler: Handler,
  schema?: Record<string, unknown>,
): HttpRouteDefinition {
  return {
    method,
    path,
    summary,
    tags: ["Identity"],
    public: true,
    handler,
    ...(schema ? { schema } : {}),
  };
}

function protectedRoute(
  method: HttpRouteDefinition["method"],
  path: string,
  summary: string,
  permission: string,
  handler: Handler,
  schema?: Record<string, unknown>,
): HttpRouteDefinition {
  return {
    method,
    path,
    summary,
    tags: [path.includes("/admin/") ? "Identity Admin" : "Identity"],
    public: false,
    permission,
    handler,
    ...(schema ? { schema } : {}),
  };
}

function authResponse(
  service: IdentityService,
  result: Awaited<ReturnType<IdentityService["login"]>>,
  statusCode: number,
): Awaited<ReturnType<Handler>> {
  return {
    statusCode,
    headers: { "set-cookie": service.refreshCookie(result.refreshToken, result.refreshTokenExpiresAt) },
    body: {
      accessToken: result.accessToken,
      tokenType: "Bearer",
      user: result.user,
    },
  };
}

function metadata(context: HttpRequestContext) {
  return {
    requestId: context.requestId,
    ipAddress: context.ip,
    userAgent: header(context, "user-agent"),
  };
}

function principalId(context: HttpRequestContext): string {
  if (!context.principal) {
    throw new AppError({
      code: "IDENTITY_AUTHENTICATION_REQUIRED",
      message: "Authentication is required",
      statusCode: 401,
    });
  }
  return context.principal.subject;
}

function readCookie(context: HttpRequestContext, name: string): string | null {
  const cookie = header(context, "cookie");
  if (!cookie) return null;
  for (const segment of cookie.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const key = decodeURIComponent(segment.slice(0, separator).trim());
    if (key === name) return decodeURIComponent(segment.slice(separator + 1).trim());
  }
  return null;
}

function header(context: HttpRequestContext, name: string): string | null {
  const value = context.headers[name];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function missingRefreshToken(): AppError {
  return new AppError({
    code: "IDENTITY_REFRESH_TOKEN_REQUIRED",
    message: "Refresh token is required",
    statusCode: 401,
  });
}

function publicSession(session: IdentitySession) {
  return {
    id: session.id,
    userId: session.userId,
    familyId: session.familyId,
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt?.toISOString() ?? null,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    lastUsedAt: session.lastUsedAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
  };
}

function publicRole(role: IdentityRole) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    system: role.system,
    permissions: role.permissions,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

const idParamsJsonSchema = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string" } },
};
const paginationJsonSchema = {
  type: "object",
  properties: {
    page: { type: "integer", minimum: 1, default: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};
const usersQueryJsonSchema = {
  ...paginationJsonSchema,
  properties: {
    ...paginationJsonSchema.properties,
    search: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "DISABLED"] },
  },
};
const sessionsQueryJsonSchema = {
  ...paginationJsonSchema,
  properties: { ...paginationJsonSchema.properties, userId: { type: "string" } },
};
const registerBodySchema = {
  type: "object",
  required: ["email", "password", "firstName", "lastName"],
  properties: {
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 12 },
    firstName: { type: "string" },
    lastName: { type: "string" },
  },
};
const loginBodySchema = {
  type: "object",
  required: ["email", "password"],
  properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
};
const emailBodySchema = {
  type: "object",
  required: ["email"],
  properties: { email: { type: "string", format: "email" } },
};
const tokenBodySchema = {
  type: "object",
  required: ["token"],
  properties: { token: { type: "string" } },
};
const resetPasswordBodySchema = {
  type: "object",
  required: ["token", "password"],
  properties: { token: { type: "string" }, password: { type: "string", minLength: 12 } },
};
const profileBodySchema = {
  type: "object",
  properties: { firstName: { type: "string" }, lastName: { type: "string" } },
};
const roleIdsBodySchema = {
  type: "object",
  required: ["roleIds"],
  properties: { roleIds: { type: "array", items: { type: "string" } } },
};
const createUserBodySchema = {
  ...registerBodySchema,
  properties: {
    ...registerBodySchema.properties,
    roleIds: { type: "array", items: { type: "string" } },
    status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "DISABLED"] },
    emailVerified: { type: "boolean" },
  },
};
const updateUserBodySchema = {
  type: "object",
  properties: {
    email: { type: "string", format: "email" },
    firstName: { type: "string" },
    lastName: { type: "string" },
    status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "DISABLED"] },
  },
};
const roleBodySchema = {
  type: "object",
  required: ["name", "permissionIds"],
  properties: {
    name: { type: "string" },
    description: { type: ["string", "null"] },
    permissionIds: { type: "array", items: { type: "string" } },
  },
};
const roleUpdateBodySchema = { ...roleBodySchema, required: [] };
const authResponseSchema = {
  type: "object",
  required: ["accessToken", "tokenType", "user"],
  properties: {
    accessToken: { type: "string" },
    tokenType: { type: "string" },
    user: { type: "object", additionalProperties: true },
  },
};
