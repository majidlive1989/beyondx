import type { PlatformIdentity } from "../domain/platform-identity.js";

export const PLATFORM_INFO_SERVICE = Symbol.for("beyondx.foundation.platform-info");

export class GetPlatformInfoService {
  constructor(private readonly identity: Readonly<PlatformIdentity>) {}

  execute(): Readonly<PlatformIdentity> {
    return this.identity;
  }
}
