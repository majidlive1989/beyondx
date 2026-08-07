import {
  ACCESS_TOKEN_AUTHENTICATOR,
  type BeyondXModule,
  type ModuleContext,
  type ModuleManifest,
  type ServiceToken,
} from "@beyondx/core";
import type { PrismaClient } from "@beyondx/database";
import { IdentityService } from "./application/identity-service.js";
import { BcryptPasswordHasher, HmacTokenService } from "./application/crypto-services.js";
import { IDENTITY_PERMISSIONS } from "./domain/permissions.js";
import { createIdentityRoutes } from "./api/routes.js";
import { PrismaIdentityRepository } from "./infrastructure/prisma-identity-repository.js";
import { SmtpMailer } from "./infrastructure/smtp-mailer.js";

export const IDENTITY_SERVICE: ServiceToken<IdentityService> = Object.freeze({
  key: "identity.service",
});

export interface IdentityModuleOptions {
  database: PrismaClient;
  passwordSaltRounds: number;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  emailVerificationExpiresIn: string;
  passwordResetExpiresIn: string;
  adminUrl: string;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  loginMaxAttempts: number;
  loginLockMinutes: number;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    from: string;
  };
}

export const IDENTITY_MANIFEST: ModuleManifest = Object.freeze({
  name: "@beyondx/module-identity",
  displayName: "Identity and Access Management",
  version: "0.2.0",
  description: "Authentication, users, sessions, roles, permissions and audit logs",
  dependencies: ["@beyondx/module-foundation"],
  optionalDependencies: [],
  permissions: IDENTITY_PERMISSIONS.map((permission) => permission.id),
  capabilities: [
    "identity.authentication",
    "identity.users",
    "identity.roles",
    "identity.permissions",
    "identity.sessions",
    "identity.audit",
  ],
});

export class IdentityModule implements BeyondXModule {
  readonly manifest = IDENTITY_MANIFEST;

  constructor(private readonly options: IdentityModuleOptions) {}

  register(context: ModuleContext): Promise<void> {
    const repository = new PrismaIdentityRepository(this.options.database);
    const service = new IdentityService(
      repository,
      new BcryptPasswordHasher(this.options.passwordSaltRounds),
      new HmacTokenService({
        accessSecret: this.options.jwtAccessSecret,
        refreshSecret: this.options.jwtRefreshSecret,
        accessExpiresIn: this.options.jwtAccessExpiresIn,
        refreshExpiresIn: this.options.jwtRefreshExpiresIn,
        emailVerificationExpiresIn: this.options.emailVerificationExpiresIn,
        passwordResetExpiresIn: this.options.passwordResetExpiresIn,
      }),
      new SmtpMailer(this.options.smtp),
      {
        adminUrl: this.options.adminUrl,
        refreshCookieName: this.options.refreshCookieName,
        refreshCookieSecure: this.options.refreshCookieSecure,
        loginMaxAttempts: this.options.loginMaxAttempts,
        loginLockMinutes: this.options.loginLockMinutes,
      },
    );

    context.services.registerValue(IDENTITY_SERVICE, service);
    context.services.registerValue(ACCESS_TOKEN_AUTHENTICATOR, service);
    for (const permission of IDENTITY_PERMISSIONS) {
      context.permissions.register({
        ...permission,
        module: this.manifest.name,
      });
    }
    for (const route of createIdentityRoutes(service)) {
      context.routes.register(this.manifest.name, route);
    }
    context.health.register({
      id: "module.identity",
      critical: true,
      check: async () => {
        await this.options.database.user.count();
        return {
          status: "healthy",
          message: "Identity persistence is available",
        };
      },
    });
    return Promise.resolve();
  }

  async boot(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "identity.module.booted",
      version: 1,
      payload: { module: this.manifest.name, version: this.manifest.version },
    });
    context.logger.info({ module: this.manifest.name }, "Identity module booted");
  }

  async shutdown(context: ModuleContext): Promise<void> {
    await context.events.publish({
      name: "identity.module.stopping",
      version: 1,
      payload: { module: this.manifest.name },
    });
    context.logger.info({ module: this.manifest.name }, "Identity module stopped");
  }
}
