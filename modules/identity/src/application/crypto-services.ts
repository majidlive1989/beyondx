import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { AppError } from "@beyondx/core";
import type {
  AccessTokenClaims,
  OneTimeTokenKind,
  PasswordHasher,
  TokenService,
} from "./contracts.js";
import type { IdentityUser } from "../domain/models.js";

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function parseDurationSeconds(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new AppError({
      code: "IDENTITY_INVALID_TOKEN_DURATION",
      message: `Invalid token duration: ${value}`,
      statusCode: 500,
    });
  }
  const amountText = match[1];
  const unit = match[2];
  if (!amountText || !unit) {
    throw new AppError({
      code: "IDENTITY_INVALID_TOKEN_DURATION",
      message: `Invalid token duration: ${value}`,
      statusCode: 500,
    });
  }
  const amount = Number(amountText);
  const multiplier = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3_600 : 86_400;
  return amount * multiplier;
}

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly rounds: number) {}

  hash(password: string): Promise<string> {
    return hash(password, this.rounds);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}

export interface HmacTokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  emailVerificationExpiresIn: string;
  passwordResetExpiresIn: string;
}

export class HmacTokenService implements TokenService {
  readonly #accessSeconds: number;
  readonly #refreshSeconds: number;
  readonly #emailVerificationSeconds: number;
  readonly #passwordResetSeconds: number;

  constructor(private readonly options: HmacTokenServiceOptions) {
    this.#accessSeconds = parseDurationSeconds(options.accessExpiresIn);
    this.#refreshSeconds = parseDurationSeconds(options.refreshExpiresIn);
    this.#emailVerificationSeconds = parseDurationSeconds(options.emailVerificationExpiresIn);
    this.#passwordResetSeconds = parseDurationSeconds(options.passwordResetExpiresIn);
  }

  createAccessToken(input: { user: IdentityUser; sessionId: string }): string {
    const issuedAt = Math.floor(Date.now() / 1_000);
    const claims: AccessTokenClaims = {
      sub: input.user.id,
      sid: input.sessionId,
      email: input.user.email,
      permissions: [...input.user.permissions].sort(),
      iat: issuedAt,
      exp: issuedAt + this.#accessSeconds,
      jti: randomUUID(),
    };
    const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64UrlEncode(JSON.stringify(claims));
    const signature = this.sign(`${header}.${payload}`);
    return `${header}.${payload}.${signature}`;
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const segments = token.split(".");
    if (segments.length !== 3) throw this.invalidToken();
    const [header, payload, signature] = segments as [string, string, string];
    const expected = this.sign(`${header}.${payload}`);
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw this.invalidToken();
    }

    try {
      const parsedHeader = JSON.parse(base64UrlDecode(header)) as { alg?: unknown; typ?: unknown };
      const claims = JSON.parse(base64UrlDecode(payload)) as AccessTokenClaims;
      if (parsedHeader.alg !== "HS256" || parsedHeader.typ !== "JWT") throw this.invalidToken();
      if (
        typeof claims.sub !== "string" ||
        typeof claims.sid !== "string" ||
        typeof claims.email !== "string" ||
        !Array.isArray(claims.permissions) ||
        !claims.permissions.every((permission) => typeof permission === "string") ||
        typeof claims.iat !== "number" ||
        typeof claims.exp !== "number" ||
        typeof claims.jti !== "string"
      ) {
        throw this.invalidToken();
      }
      if (claims.exp <= Math.floor(Date.now() / 1_000)) {
        throw new AppError({
          code: "IDENTITY_ACCESS_TOKEN_EXPIRED",
          message: "Access token has expired",
          statusCode: 401,
        });
      }
      return claims;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw this.invalidToken();
    }
  }

  createOpaqueToken(): string {
    return `${randomUUID()}.${randomBytes(48).toString("base64url")}`;
  }

  hashOpaqueToken(token: string): string {
    return createHmac("sha256", this.options.refreshSecret).update(token).digest("hex");
  }

  refreshTokenExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + this.#refreshSeconds * 1_000);
  }

  oneTimeTokenExpiresAt(kind: OneTimeTokenKind, now = new Date()): Date {
    const seconds =
      kind === "email-verification"
        ? this.#emailVerificationSeconds
        : this.#passwordResetSeconds;
    return new Date(now.getTime() + seconds * 1_000);
  }

  private sign(value: string): string {
    return createHmac("sha256", this.options.accessSecret).update(value).digest("base64url");
  }

  private invalidToken(): AppError {
    return new AppError({
      code: "IDENTITY_INVALID_ACCESS_TOKEN",
      message: "Access token is invalid",
      statusCode: 401,
    });
  }
}

export function fingerprintToken(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}
