import { describe, expect, it } from "vitest";
import { HmacTokenService, parseDurationSeconds } from "../src/application/crypto-services.js";
import type { IdentityUser } from "../src/domain/models.js";

const user: IdentityUser = { id:"user-1",email:"admin@beyondx.local",passwordHash:"hash",firstName:"BeyondX",lastName:"Admin",status:"ACTIVE",emailVerifiedAt:new Date(),lastLoginAt:null,failedLoginAttempts:0,lockedUntil:null,roles:[],permissions:["identity.users.read"],createdAt:new Date(),updatedAt:new Date() };

describe("HmacTokenService",()=>{
  it("creates and verifies signed access tokens",()=>{const service=new HmacTokenService({accessSecret:"a".repeat(64),refreshSecret:"b".repeat(64),accessExpiresIn:"15m",refreshExpiresIn:"30d",emailVerificationExpiresIn:"24h",passwordResetExpiresIn:"1h"});const token=service.createAccessToken({user,sessionId:"session-1"});expect(service.verifyAccessToken(token)).toMatchObject({sub:"user-1",sid:"session-1",permissions:["identity.users.read"]});});
  it("rejects tampered tokens",()=>{const service=new HmacTokenService({accessSecret:"a".repeat(64),refreshSecret:"b".repeat(64),accessExpiresIn:"15m",refreshExpiresIn:"30d",emailVerificationExpiresIn:"24h",passwordResetExpiresIn:"1h"});const token=service.createAccessToken({user,sessionId:"session-1"});expect(()=>service.verifyAccessToken(`${token}x`)).toThrow(/invalid/i);});
  it("parses supported duration units",()=>{expect(parseDurationSeconds("15m")).toBe(900);expect(parseDurationSeconds("30d")).toBe(2592000);});
});
