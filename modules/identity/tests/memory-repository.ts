import { randomUUID } from "node:crypto";
import type {
  CreateAuditRecordInput,
  CreateSessionRecordInput,
  CreateUserRecordInput,
  IdentityRepository,
  OneTimeTokenKind,
  UpdateUserRecordInput,
} from "../src/application/contracts.js";
import type {
  IdentityAuditLog,
  IdentityRole,
  IdentitySession,
  IdentityUser,
  Page,
  PaginationInput,
  UserStatus,
} from "../src/domain/models.js";

interface TokenRecord { userId: string; expiresAt: Date; usedAt: Date | null }

export class MemoryIdentityRepository implements IdentityRepository {
  readonly users = new Map<string, IdentityUser>();
  readonly sessions = new Map<string, IdentitySession>();
  readonly roles = new Map<string, IdentityRole>();
  readonly permissions = new Map<string, { id: string; description: string; module: string }>();
  readonly audits: IdentityAuditLog[] = [];
  readonly tokens = new Map<string, TokenRecord>();

  constructor() {
    this.addRole("role-super", "SUPER_ADMIN", ["identity.users.read", "identity.profile.read"]);
    this.addRole("role-user", "USER", [
      "identity.profile.read",
      "identity.profile.update",
      "identity.sessions.read",
      "identity.sessions.revoke",
    ]);
    for (const role of this.roles.values()) {
      for (const id of role.permissions) {
        this.permissions.set(id, { id, description: id, module: "@beyondx/module-identity" });
      }
    }
  }

  addRole(id: string, name: string, permissions: string[], system = true): IdentityRole {
    const now = new Date();
    const role: IdentityRole = { id, name, permissions, system, description: name, createdAt: now, updatedAt: now };
    this.roles.set(id, role);
    return role;
  }

  findUserByEmail(email: string): Promise<IdentityUser | null> {
    return Promise.resolve([...this.users.values()].find((user) => user.email === email) ?? null);
  }
  findUserById(id: string): Promise<IdentityUser | null> { return Promise.resolve(this.users.get(id) ?? null); }
  createUser(input: CreateUserRecordInput): Promise<IdentityUser> {
    const now = new Date();
    const roles = [...this.roles.values()].filter((role) => input.roleNames.includes(role.name));
    const user: IdentityUser = {
      id: randomUUID(), email: input.email, passwordHash: input.passwordHash,
      firstName: input.firstName, lastName: input.lastName, status: "ACTIVE",
      emailVerifiedAt: input.emailVerifiedAt ?? null, lastLoginAt: null,
      failedLoginAttempts: 0, lockedUntil: null, roles,
      permissions: [...new Set(roles.flatMap((role) => role.permissions))],
      createdAt: now, updatedAt: now,
    };
    this.users.set(user.id, user); return Promise.resolve(user);
  }
  updateUser(id: string, input: UpdateUserRecordInput): Promise<IdentityUser> {
    const user = this.requireUser(id); Object.assign(user, input, { updatedAt: new Date() }); return Promise.resolve(user);
  }
  updatePassword(userId: string, passwordHash: string): Promise<void> { const user=this.requireUser(userId); user.passwordHash=passwordHash; user.failedLoginAttempts=0; user.lockedUntil=null; return Promise.resolve(); }
  recordFailedLogin(userId: string, failedAttempts: number, lockedUntil: Date | null): Promise<void> { const user=this.requireUser(userId); user.failedLoginAttempts=failedAttempts; user.lockedUntil=lockedUntil; return Promise.resolve(); }
  recordSuccessfulLogin(userId: string, at: Date): Promise<void> { const user=this.requireUser(userId); user.lastLoginAt=at; user.failedLoginAttempts=0; user.lockedUntil=null; return Promise.resolve(); }
  markEmailVerified(userId: string, at: Date): Promise<void> { this.requireUser(userId).emailVerifiedAt=at; return Promise.resolve(); }

  createSession(input: CreateSessionRecordInput): Promise<IdentitySession> {
    const now=new Date(); const session: IdentitySession={id:randomUUID(),userId:input.userId,refreshTokenHash:input.refreshTokenHash,familyId:input.familyId,expiresAt:input.expiresAt,revokedAt:null,replacedBySessionId:null,userAgent:input.userAgent??null,ipAddress:input.ipAddress??null,lastUsedAt:now,createdAt:now}; this.sessions.set(session.id,session); return Promise.resolve(session);
  }
  findSessionById(id: string): Promise<IdentitySession | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }
  findSessionByRefreshTokenHash(hash: string): Promise<IdentitySession | null> { const session=[...this.sessions.values()].find((item)=>item.refreshTokenHash===hash); return Promise.resolve(session?{...session,user:this.requireUser(session.userId)}:null); }
  async rotateSession(currentSessionId: string, replacement: CreateSessionRecordInput, at: Date): Promise<IdentitySession> { const current=this.sessions.get(currentSessionId); if(!current||current.revokedAt) throw new Error("conflict"); current.revokedAt=at; const created=await this.createSession(replacement); current.replacedBySessionId=created.id; return created; }
  revokeSession(sessionId: string, at: Date): Promise<void> { const session=this.sessions.get(sessionId); if(session) session.revokedAt??=at; return Promise.resolve(); }
  revokeSessionByRefreshHash(hash: string, at: Date): Promise<void> { for(const session of this.sessions.values()) if(session.refreshTokenHash===hash) session.revokedAt??=at; return Promise.resolve(); }
  revokeAllUserSessions(userId: string, at: Date): Promise<number> { let count=0; for(const session of this.sessions.values()) if(session.userId===userId&&!session.revokedAt){session.revokedAt=at;count++;} return Promise.resolve(count); }
  revokeSessionFamily(familyId: string, at: Date): Promise<number> { let count=0; for(const session of this.sessions.values()) if(session.familyId===familyId&&!session.revokedAt){session.revokedAt=at;count++;} return Promise.resolve(count); }
  listUserSessions(userId: string): Promise<IdentitySession[]> { return Promise.resolve([...this.sessions.values()].filter((session)=>session.userId===userId)); }
  listSessions(input: PaginationInput & { userId?: string }): Promise<Page<IdentitySession>> { return Promise.resolve(makePage([...this.sessions.values()].filter((session)=>!input.userId||session.userId===input.userId),input)); }

  createOneTimeToken(kind: OneTimeTokenKind, userId: string, tokenHash: string, expiresAt: Date): Promise<void> { this.tokens.set(`${kind}:${tokenHash}`,{userId,expiresAt,usedAt:null}); return Promise.resolve(); }
  consumeOneTimeToken(kind: OneTimeTokenKind, tokenHash: string, at: Date): Promise<{userId:string}|null> { const token=this.tokens.get(`${kind}:${tokenHash}`); if(!token||token.usedAt||token.expiresAt<=at)return Promise.resolve(null); token.usedAt=at; return Promise.resolve({userId:token.userId}); }
  invalidateOneTimeTokens(kind: OneTimeTokenKind, userId: string, at: Date): Promise<void> { for(const [key,token] of this.tokens) if(key.startsWith(`${kind}:`)&&token.userId===userId&&!token.usedAt)token.usedAt=at; return Promise.resolve(); }

  listUsers(input: PaginationInput & { search?: string; status?: UserStatus }): Promise<Page<IdentityUser>> { const term=input.search?.toLowerCase(); const items=[...this.users.values()].filter((user)=>(!input.status||user.status===input.status)&&(!term||`${user.email} ${user.firstName} ${user.lastName}`.toLowerCase().includes(term))); return Promise.resolve(makePage(items,input)); }
  assignUserRoles(userId: string, roleIds: string[]): Promise<IdentityUser> { const user=this.requireUser(userId); user.roles=roleIds.map((id)=>this.roles.get(id)).filter((role):role is IdentityRole=>Boolean(role)); user.permissions=[...new Set(user.roles.flatMap((role)=>role.permissions))]; return Promise.resolve(user); }
  listRoles(): Promise<IdentityRole[]> { return Promise.resolve([...this.roles.values()]); }
  findRoleById(id: string): Promise<IdentityRole|null> { return Promise.resolve(this.roles.get(id)??null); }
  createRole(input: {name:string;description?:string|null;permissionIds:string[]}): Promise<IdentityRole> { const now=new Date(); const role:IdentityRole={id:randomUUID(),name:input.name,description:input.description??null,system:false,permissions:input.permissionIds,createdAt:now,updatedAt:now};this.roles.set(role.id,role);return Promise.resolve(role); }
  updateRole(
    id: string,
    input: { name?: string; description?: string | null; permissionIds?: string[] },
  ): Promise<IdentityRole> {
    const role = this.roles.get(id);
    if (!role) throw new Error("missing");
    if (input.name !== undefined) role.name = input.name;
    if (input.description !== undefined) role.description = input.description;
    if (input.permissionIds !== undefined) role.permissions = [...input.permissionIds];
    role.updatedAt = new Date();
    return Promise.resolve(role);
  }
  deleteRole(id:string):Promise<void>{this.roles.delete(id);return Promise.resolve();}
  listPermissions():Promise<Array<{id:string;description:string;module:string}>>{return Promise.resolve([...this.permissions.values()]);}
  createAuditLog(input:CreateAuditRecordInput):Promise<void>{this.audits.push({id:randomUUID(),actorUserId:input.actorUserId??null,action:input.action,targetType:input.targetType,targetId:input.targetId??null,requestId:input.requestId??null,ipAddress:input.ipAddress??null,userAgent:input.userAgent??null,metadata:input.metadata??null,createdAt:new Date()});return Promise.resolve();}
  listAuditLogs(input:PaginationInput):Promise<Page<IdentityAuditLog>>{return Promise.resolve(makePage(this.audits,input));}

  private requireUser(id:string):IdentityUser{const user=this.users.get(id);if(!user)throw new Error(`Missing user ${id}`);return user;}
}

function makePage<T>(all:T[],input:PaginationInput):Page<T>{const start=(input.page-1)*input.pageSize;return{items:all.slice(start,start+input.pageSize),page:input.page,pageSize:input.pageSize,total:all.length,pageCount:Math.ceil(all.length/input.pageSize)};}
