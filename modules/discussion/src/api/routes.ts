import type { HttpRequestContext, HttpRouteDefinition } from "@beyondx/core";
import { parseInput } from "@beyondx/validation";
import { z } from "zod";
import type {
  DiscussionMutationContext,
  DiscussionService,
} from "../application/discussion-service.js";

const sourceType = z.enum(["CONTENT", "PRODUCT"]);
const kind = z.enum(["COMMENT", "REVIEW"]);
const status = z.enum(["PENDING", "APPROVED", "SPAM", "TRASH"]);
const sourceParams = z.object({ sourceType, sourceId: z.string().min(1) });
const idParams = z.object({ id: z.string().min(1) });
const publicQuery = z.object({
  kind: kind.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
const adminQuery = z.object({
  search: z.string().trim().max(250).optional(),
  sourceType: sourceType.optional(),
  sourceId: z.string().min(1).optional(),
  kind: kind.optional(),
  status: status.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
const submission = z.object({
  sourceType,
  sourceId: z.string().min(1),
  kind,
  parentId: z.string().min(1).optional(),
  authorName: z.string().trim().min(1).max(120),
  authorEmail: z.string().trim().email().max(320),
  body: z.string().trim().min(2).max(10_000),
  rating: z.number().int().min(1).max(5).optional(),
});
const moderation = z.object({ status });
const reply = z.object({ body: z.string().trim().min(1).max(10_000), authorName: z.string().trim().min(1).max(120).optional() });
const settings = z.object({
  commentsEnabled: z.boolean(),
  reviewsEnabled: z.boolean(),
  ratingEnabled: z.boolean(),
  verifiedPurchaseOnly: z.boolean(),
  notifyOnNew: z.boolean(),
});

const sourceParamsJsonSchema = {
  type: "object",
  required: ["sourceType", "sourceId"],
  properties: {
    sourceType: { type: "string", enum: ["CONTENT", "PRODUCT"] },
    sourceId: { type: "string", minLength: 1 },
  },
};
const idParamsJsonSchema = { type: "object", required: ["id"], properties: { id: { type: "string", minLength: 1 } } };
const publicQueryJsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["COMMENT", "REVIEW"] },
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100 },
  },
};
const adminQueryJsonSchema = {
  type: "object",
  properties: {
    search: { type: "string", maxLength: 250 },
    sourceType: { type: "string", enum: ["CONTENT", "PRODUCT"] },
    sourceId: { type: "string" },
    kind: { type: "string", enum: ["COMMENT", "REVIEW"] },
    status: { type: "string", enum: ["PENDING", "APPROVED", "SPAM", "TRASH"] },
    page: { type: "integer", minimum: 1 },
    pageSize: { type: "integer", minimum: 1, maximum: 100 },
  },
};
const submissionJsonSchema = {
  type: "object",
  required: ["sourceType", "sourceId", "kind", "authorName", "authorEmail", "body"],
  properties: {
    sourceType: { type: "string", enum: ["CONTENT", "PRODUCT"] },
    sourceId: { type: "string", minLength: 1 },
    kind: { type: "string", enum: ["COMMENT", "REVIEW"] },
    parentId: { type: "string", minLength: 1 },
    authorName: { type: "string", minLength: 1, maxLength: 120 },
    authorEmail: { type: "string", format: "email", maxLength: 320 },
    body: { type: "string", minLength: 2, maxLength: 10000 },
    rating: { type: "integer", minimum: 1, maximum: 5 },
  },
};
const moderationJsonSchema = { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["PENDING", "APPROVED", "SPAM", "TRASH"] } } };
const replyJsonSchema = { type: "object", required: ["body"], properties: { body: { type: "string", minLength: 1, maxLength: 10000 }, authorName: { type: "string", minLength: 1, maxLength: 120 } } };
const settingsJsonSchema = {
  type: "object",
  required: ["commentsEnabled", "reviewsEnabled", "ratingEnabled", "verifiedPurchaseOnly", "notifyOnNew"],
  properties: {
    commentsEnabled: { type: "boolean" },
    reviewsEnabled: { type: "boolean" },
    ratingEnabled: { type: "boolean" },
    verifiedPurchaseOnly: { type: "boolean" },
    notifyOnNew: { type: "boolean" },
  },
};

function mutationContext(context: HttpRequestContext): DiscussionMutationContext {
  return {
    ...(context.principal === undefined ? {} : { actorUserId: context.principal.subject }),
    requestId: context.requestId,
  };
}

export function createDiscussionRoutes(service: DiscussionService): HttpRouteDefinition[] {
  return [
    {
      method: "GET",
      path: "/api/v1/discussions/:sourceType/:sourceId",
      summary: "List approved comments or reviews for a published source",
      tags: ["Discussion"],
      public: true,
      schema: { params: sourceParamsJsonSchema, querystring: publicQueryJsonSchema },
      handler: async (context) => {
        const params = parseInput(sourceParams, context.params);
        const query = parseInput(publicQuery, context.query);
        return {
          body: await service.getPublicThread({
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            page: query.page,
            pageSize: query.pageSize,
            ...(query.kind === undefined ? {} : { kind: query.kind }),
          }),
        };
      },
    },
    {
      method: "POST",
      path: "/api/v1/discussions",
      summary: "Submit a comment or product review for moderation",
      tags: ["Discussion"],
      public: true,
      schema: { body: submissionJsonSchema },
      handler: async (context) => {
        const input = parseInput(submission, context.body);
        const entry = await service.submit({
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          kind: input.kind,
          authorName: input.authorName,
          authorEmail: input.authorEmail,
          body: input.body,
          ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
          ...(input.rating === undefined ? {} : { rating: input.rating }),
        });
        return { statusCode: 201, body: { entry } };
      },
    },
    {
      method: "GET",
      path: "/api/v1/admin/discussions",
      summary: "List comments and reviews for moderation",
      tags: ["Discussion Admin"],
      public: false,
      permission: "discussion.entries.read",
      schema: { querystring: adminQueryJsonSchema },
      handler: async (context) => {
        const query = parseInput(adminQuery, context.query);
        return {
          body: await service.listAdmin({
            page: query.page,
            pageSize: query.pageSize,
            ...(query.search === undefined ? {} : { search: query.search }),
            ...(query.sourceType === undefined ? {} : { sourceType: query.sourceType }),
            ...(query.sourceId === undefined ? {} : { sourceId: query.sourceId }),
            ...(query.kind === undefined ? {} : { kind: query.kind }),
            ...(query.status === undefined ? {} : { status: query.status }),
          }),
        };
      },
    },
    {
      method: "PATCH",
      path: "/api/v1/admin/discussions/:id/status",
      summary: "Moderate a comment or review",
      tags: ["Discussion Admin"],
      public: false,
      permission: "discussion.entries.moderate",
      schema: { params: idParamsJsonSchema, body: moderationJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParams, context.params);
        const body = parseInput(moderation, context.body);
        return { body: { entry: await service.setStatus(id, body.status, mutationContext(context)) } };
      },
    },
    {
      method: "POST",
      path: "/api/v1/admin/discussions/:id/replies",
      summary: "Reply to a comment or product review",
      tags: ["Discussion Admin"],
      public: false,
      permission: "discussion.entries.reply",
      schema: { params: idParamsJsonSchema, body: replyJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParams, context.params);
        const input = parseInput(reply, context.body);
        return {
          statusCode: 201,
          body: {
            entry: await service.reply(
              id,
              {
                body: input.body,
                ...(input.authorName === undefined ? {} : { authorName: input.authorName }),
              },
              mutationContext(context),
            ),
          },
        };
      },
    },
    {
      method: "DELETE",
      path: "/api/v1/admin/discussions/:id",
      summary: "Permanently delete a comment or review",
      tags: ["Discussion Admin"],
      public: false,
      permission: "discussion.entries.delete",
      schema: { params: idParamsJsonSchema },
      handler: async (context) => {
        const { id } = parseInput(idParams, context.params);
        await service.deletePermanently(id, mutationContext(context));
        return { statusCode: 204, body: null };
      },
    },
    {
      method: "GET",
      path: "/api/v1/admin/discussions/settings/:sourceType/:sourceId",
      summary: "Get discussion settings for content or product",
      tags: ["Discussion Admin"],
      public: false,
      permission: "discussion.entries.read",
      schema: { params: sourceParamsJsonSchema },
      handler: async (context) => {
        const params = parseInput(sourceParams, context.params);
        return { body: { settings: await service.getSettings(params.sourceType, params.sourceId) } };
      },
    },
    {
      method: "PUT",
      path: "/api/v1/admin/discussions/settings/:sourceType/:sourceId",
      summary: "Update discussion settings for content or product",
      tags: ["Discussion Admin"],
      public: false,
      permission: "discussion.settings.manage",
      schema: { params: sourceParamsJsonSchema, body: settingsJsonSchema },
      handler: async (context) => {
        const params = parseInput(sourceParams, context.params);
        const body = parseInput(settings, context.body);
        return {
          body: {
            settings: await service.updateSettings(
              params.sourceType,
              params.sourceId,
              body,
              mutationContext(context),
            ),
          },
        };
      },
    },
  ];
}

