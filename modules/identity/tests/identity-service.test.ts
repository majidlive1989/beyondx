import { describe, expect, it } from "vitest";
import { IdentityService } from "../src/application/identity-service.js";
import { HmacTokenService } from "../src/application/crypto-services.js";
import type { Mailer, PasswordHasher } from "../src/application/contracts.js";
import { MemoryIdentityRepository } from "./memory-repository.js";

class PlainHasher implements PasswordHasher { hash(password:string){return Promise.resolve(`hash:${password}`)} verify(password:string,hash:string){return Promise.resolve(hash===`hash:${password}`)} }
class CapturingMailer implements Mailer { readonly messages: string[]=[]; send(message:{to:string}){this.messages.push(message.to);return Promise.resolve();} }
const metadata={requestId:"test",ipAddress:"127.0.0.1",userAgent:"vitest"};
function create(){const repository=new MemoryIdentityRepository();const mailer=new CapturingMailer();const service=new IdentityService(repository,new PlainHasher(),new HmacTokenService({accessSecret:"a".repeat(64),refreshSecret:"b".repeat(64),accessExpiresIn:"15m",refreshExpiresIn:"30d",emailVerificationExpiresIn:"24h",passwordResetExpiresIn:"1h"}),mailer,{adminUrl:"http://localhost:3000",refreshCookieName:"beyondx_refresh",refreshCookieSecure:false,loginMaxAttempts:3,loginLockMinutes:15});return{repository,mailer,service};}

describe("IdentityService",()=>{
  it("registers a user, sends verification, and creates a session",async()=>{const{service,mailer}=create();const result=await service.register({email:"USER@EXAMPLE.COM",password:"ValidPassword1",firstName:"Test",lastName:"User"},metadata);expect(result.user.email).toBe("user@example.com");expect(result.accessToken.split(".")).toHaveLength(3);expect(mailer.messages).toEqual(["user@example.com"]);});
  it("rotates refresh tokens and rejects reuse",async()=>{const{service}=create();const registered=await service.register({email:"user@example.com",password:"ValidPassword1",firstName:"Test",lastName:"User"},metadata);const rotated=await service.refresh(registered.refreshToken,metadata);expect(rotated.refreshToken).not.toBe(registered.refreshToken);await expect(service.refresh(registered.refreshToken,metadata)).rejects.toMatchObject({code:"IDENTITY_REFRESH_TOKEN_REUSED"});});
  it("locks an account after repeated failed logins",async()=>{const{service}=create();await service.register({email:"user@example.com",password:"ValidPassword1",firstName:"Test",lastName:"User"},metadata);for(let index=0;index<3;index++)await expect(service.login({email:"user@example.com",password:"wrong"},metadata)).rejects.toMatchObject({code:"IDENTITY_INVALID_CREDENTIALS"});await expect(service.login({email:"user@example.com",password:"ValidPassword1"},metadata)).rejects.toMatchObject({code:"IDENTITY_ACCOUNT_TEMPORARILY_LOCKED"});});
  it("rejects role definitions containing unknown permissions",async()=>{const{service}=create();await expect(service.createRole("actor-1",{name:"EDITOR",permissionIds:["identity.missing"]},metadata)).rejects.toMatchObject({code:"IDENTITY_PERMISSION_NOT_FOUND"});});
});
