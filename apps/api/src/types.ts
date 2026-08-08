import type { AppConfig } from "@beyondx/config";
import type { AccessTokenAuthenticator, HealthRegistry, HttpRouteRegistry, ModuleRuntimeStatus } from "@beyondx/core";
import type {
  FastifyInstance,
  FastifyTypeProviderDefault,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { Logger } from "pino";

export type BeyondXFastifyInstance = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  Logger,
  FastifyTypeProviderDefault
>;

export interface ApplicationDependencies {
  config: AppConfig;
  logger: Logger;
  health: HealthRegistry;
  routes: HttpRouteRegistry;
  authenticator: AccessTokenAuthenticator;
  modules: () => ModuleRuntimeStatus[];
  isPluginActive: (packageName: string) => boolean;
  close: () => Promise<void>;
}

export interface RequestPrincipal {
  subject: string;
  permissions: ReadonlySet<string>;
}

declare module "fastify" {
  interface FastifyRequest {
    principal?: RequestPrincipal;
  }
}
