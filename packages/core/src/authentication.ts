import type { HttpPrincipal } from "./http.js";
import type { ServiceToken } from "./services.js";

export interface AccessTokenAuthenticator {
  authenticateAccessToken(token: string): Promise<HttpPrincipal>;
}

export const ACCESS_TOKEN_AUTHENTICATOR: ServiceToken<AccessTokenAuthenticator> = Object.freeze({
  key: "core.access-token-authenticator",
});
