export interface PlatformIdentity {
  name: string;
  slogan: string;
  version: string;
  apiVersion: string;
}

export const PLATFORM_IDENTITY: Readonly<PlatformIdentity> = Object.freeze({
  name: "BeyondX",
  slogan: "Build Any Digital Product",
  version: "0.1.0",
  apiVersion: "v1",
});
