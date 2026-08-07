import { getDatabaseClient } from "@beyondx/database";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaIdentityRepository } from "../src/infrastructure/prisma-identity-repository.js";

const enabled = process.env.RUN_DATABASE_TESTS === "true";
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase("PrismaIdentityRepository", () => {
  const database = getDatabaseClient();
  const repository = new PrismaIdentityRepository(database);
  const email = `repository-${Date.now()}@beyondx.local`;

  afterAll(async () => {
    await database.user.deleteMany({ where: { email } });
    await database.$disconnect();
  });

  it("persists and reads an identity user with effective permissions", async () => {
    const user = await repository.createUser({
      email,
      passwordHash: "integration-hash",
      firstName: "Repository",
      lastName: "Test",
      roleNames: ["USER"],
    });
    const loaded = await repository.findUserById(user.id);
    expect(loaded).toMatchObject({ email, firstName: "Repository" });
    expect(loaded?.roles.some((role) => role.name === "USER")).toBe(true);
  });
});
