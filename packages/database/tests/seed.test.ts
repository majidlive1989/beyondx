import type { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { seedDatabase } from "../prisma/seed-runner.js";

interface RoleRecord {
  id: string;
  name: string;
}

interface UserRecord {
  id: string;
  email: string;
  emailVerifiedAt: Date | null;
}

function createSeedClient(): {
  client: PrismaClient;
  state: {
    modules: Set<string>;
    permissions: Set<string>;
    roles: Map<string, RoleRecord>;
    users: Map<string, UserRecord>;
    userRoles: Set<string>;
    userCreates: number;
    userUpdates: number;
  };
} {
  const state = {
    modules: new Set<string>(),
    permissions: new Set<string>(),
    roles: new Map<string, RoleRecord>(),
    users: new Map<string, UserRecord>(),
    userRoles: new Set<string>(),
    userCreates: 0,
    userUpdates: 0,
  };

  const fake = {
    platformMetadata: {
      upsert: () => Promise.resolve({ key: "platform.identity" }),
    },
    moduleInstallation: {
      upsert: (input: { where: { name: string } }) => {
        state.modules.add(input.where.name);
        return Promise.resolve({ id: input.where.name });
      },
    },
    permission: {
      upsert: (input: { where: { id: string } }) => {
        state.permissions.add(input.where.id);
        return Promise.resolve({ id: input.where.id });
      },
    },
    role: {
      upsert: (input: { where: { name: string } }) => {
        const existing = state.roles.get(input.where.name);
        if (existing) return Promise.resolve(existing);
        const role = { id: `role-${state.roles.size + 1}`, name: input.where.name };
        state.roles.set(role.name, role);
        return Promise.resolve(role);
      },
    },
    rolePermission: {
      deleteMany: () => Promise.resolve({ count: 0 }),
      createMany: () => Promise.resolve({ count: 0 }),
    },
    user: {
      findUnique: (input: { where: { email: string } }) =>
        Promise.resolve(state.users.get(input.where.email) ?? null),
      create: (input: { data: { email: string; emailVerifiedAt: Date } }) => {
        state.userCreates += 1;
        const user = {
          id: `user-${state.users.size + 1}`,
          email: input.data.email,
          emailVerifiedAt: input.data.emailVerifiedAt,
        };
        state.users.set(user.email, user);
        return Promise.resolve(user);
      },
      update: (input: { where: { id: string }; data: { emailVerifiedAt: Date } }) => {
        state.userUpdates += 1;
        const user = [...state.users.values()].find((candidate) => candidate.id === input.where.id);
        if (!user) return Promise.reject(new Error("Missing fake user"));
        user.emailVerifiedAt = input.data.emailVerifiedAt;
        return Promise.resolve(user);
      },
    },
    userRole: {
      upsert: (input: { where: { userId_roleId: { userId: string; roleId: string } } }) => {
        const key = `${input.where.userId_roleId.userId}:${input.where.userId_roleId.roleId}`;
        state.userRoles.add(key);
        return Promise.resolve(input.where.userId_roleId);
      },
    },
  };

  return { client: fake as unknown as PrismaClient, state };
}

const environment = {
  ADMIN_EMAIL: "admin@beyondx.local",
  ADMIN_PASSWORD: "ChangeMe123!",
  ADMIN_FIRST_NAME: "BeyondX",
  ADMIN_LAST_NAME: "Admin",
  PASSWORD_SALT_ROUNDS: "10",
};

describe("Phase 1 database seed", () => {
  it("is idempotent across repeated runs", async () => {
    const { client, state } = createSeedClient();

    await seedDatabase(client, environment);
    await seedDatabase(client, environment);

    expect(state.modules.size).toBe(5);
    expect(state.permissions.size).toBe(14);
    expect(state.roles.size).toBe(3);
    expect(state.users.size).toBe(1);
    expect(state.userRoles.size).toBe(1);
    expect(state.userCreates).toBe(1);
    expect(state.userUpdates).toBe(1);
  });
});
