import { AppError } from "@beyondx/core";
import type { Prisma, PrismaClient } from "@beyondx/database";

export type DiscussionSourceType = "CONTENT" | "PRODUCT";
export type DiscussionKind = "COMMENT" | "REVIEW";
export type DiscussionStatus = "PENDING" | "APPROVED" | "SPAM" | "TRASH";

export interface DiscussionSubmissionInput {
  sourceType: DiscussionSourceType;
  sourceId: string;
  kind: DiscussionKind;
  parentId?: string;
  authorName: string;
  authorEmail: string;
  body: string;
  rating?: number;
}

export interface DiscussionAdminListInput {
  page: number;
  pageSize: number;
  search?: string;
  sourceType?: DiscussionSourceType;
  sourceId?: string;
  kind?: DiscussionKind;
  status?: DiscussionStatus;
}

export interface DiscussionSettingsInput {
  commentsEnabled: boolean;
  reviewsEnabled: boolean;
  ratingEnabled: boolean;
  verifiedPurchaseOnly: boolean;
  notifyOnNew: boolean;
}

export interface DiscussionMutationContext {
  actorUserId?: string;
  requestId?: string;
}

const publicReplySelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  kind: true,
  parentId: true,
  authorName: true,
  body: true,
  rating: true,
  verifiedPurchase: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DiscussionEntrySelect;

const publicRootInclude = {
  replies: {
    where: { status: "APPROVED" as const },
    select: publicReplySelect,
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.DiscussionEntryInclude;

export class DiscussionService {
  constructor(private readonly database: PrismaClient) {}

  async getPublicThread(input: {
    sourceType: DiscussionSourceType;
    sourceId: string;
    kind?: DiscussionKind;
    page: number;
    pageSize: number;
  }) {
    await this.requirePublicSource(input.sourceType, input.sourceId);
    const settings = await this.getSettings(input.sourceType, input.sourceId);
    const where: Prisma.DiscussionEntryWhereInput = {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      status: "APPROVED",
      parentId: null,
      ...(input.kind === undefined ? {} : { kind: input.kind }),
    };
    const [total, entries] = await Promise.all([
      this.database.discussionEntry.count({ where }),
      this.database.discussionEntry.findMany({
        where,
        include: publicRootInclude,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);

    const rating = input.sourceType === "PRODUCT"
      ? await this.database.discussionEntry.aggregate({
          where: {
            sourceType: "PRODUCT",
            sourceId: input.sourceId,
            kind: "REVIEW",
            status: "APPROVED",
            parentId: null,
            rating: { not: null },
          },
          _avg: { rating: true },
          _count: { rating: true },
        })
      : null;

    return {
      items: entries.map(toPublicEntry),
      page: input.page,
      pageSize: input.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
      settings: toPublicSettings(settings),
      rating: rating
        ? { average: rating._avg.rating ?? null, count: rating._count.rating }
        : null,
    };
  }

  async submit(input: DiscussionSubmissionInput) {
    await this.requirePublicSource(input.sourceType, input.sourceId);
    const settings = await this.getSettings(input.sourceType, input.sourceId);
    this.assertSubmissionAllowed(input, settings);

    let parentId: string | null = null;
    if (input.parentId) {
      if (input.kind === "REVIEW") {
        throw new AppError({
          code: "DISCUSSION_REVIEW_REPLY_INVALID",
          message: "A product review cannot be submitted as a reply",
          statusCode: 400,
        });
      }
      const parent = await this.database.discussionEntry.findUnique({ where: { id: input.parentId } });
      if (!parent || parent.parentId !== null || parent.status !== "APPROVED" || parent.sourceType !== input.sourceType || parent.sourceId !== input.sourceId) {
        throw new AppError({
          code: "DISCUSSION_PARENT_NOT_FOUND",
          message: "The comment being replied to is not available",
          statusCode: 404,
        });
      }
      parentId = parent.id;
    }

    const created = await this.database.discussionEntry.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        kind: input.kind,
        status: "PENDING",
        parentId,
        authorName: input.authorName.trim(),
        authorEmail: input.authorEmail.trim().toLowerCase(),
        body: input.body.trim(),
        rating: input.kind === "REVIEW" ? input.rating ?? null : null,
      },
      include: publicRootInclude,
    });
    return toPublicEntry(created);
  }

  async listAdmin(input: DiscussionAdminListInput) {
    const where: Prisma.DiscussionEntryWhereInput = {
      parentId: null,
      ...(input.sourceType === undefined ? {} : { sourceType: input.sourceType }),
      ...(input.sourceId === undefined ? {} : { sourceId: input.sourceId }),
      ...(input.kind === undefined ? {} : { kind: input.kind }),
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.search === undefined || input.search.trim().length === 0
        ? {}
        : {
            OR: [
              { authorName: { contains: input.search.trim(), mode: "insensitive" } },
              { authorEmail: { contains: input.search.trim(), mode: "insensitive" } },
              { body: { contains: input.search.trim(), mode: "insensitive" } },
            ],
          }),
    };
    const [total, entries] = await Promise.all([
      this.database.discussionEntry.count({ where }),
      this.database.discussionEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    const sourceLabels = await this.sourceLabels(entries.map((entry) => ({ sourceType: entry.sourceType, sourceId: entry.sourceId })));
    return {
      items: entries.map((entry) => ({
        ...entry,
        sourceLabel: sourceLabels.get(sourceKey(entry.sourceType, entry.sourceId)) ?? entry.sourceId,
      })),
      page: input.page,
      pageSize: input.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / input.pageSize)),
    };
  }

  async setStatus(id: string, status: DiscussionStatus, context: DiscussionMutationContext = {}) {
    const entry = await this.requireEntry(id);
    const updated = await this.database.discussionEntry.update({
      where: { id },
      data: {
        status,
        moderatedAt: new Date(),
        moderatedByUserId: context.actorUserId ?? null,
      },
    });
    await this.audit("discussion.moderate", id, context, { from: entry.status, to: status });
    return updated;
  }

  async reply(id: string, input: { body: string; authorName?: string }, context: DiscussionMutationContext = {}) {
    const parent = await this.requireEntry(id);
    if (parent.parentId !== null) {
      throw new AppError({ code: "DISCUSSION_REPLY_NESTING_INVALID", message: "Replies can only be added to a top-level comment or review", statusCode: 409 });
    }
    if (parent.status === "TRASH") {
      throw new AppError({ code: "DISCUSSION_REPLY_TRASHED", message: "Cannot reply to a trashed entry", statusCode: 409 });
    }
    const created = await this.database.discussionEntry.create({
      data: {
        sourceType: parent.sourceType,
        sourceId: parent.sourceId,
        kind: "COMMENT",
        status: "APPROVED",
        parentId: parent.id,
        authorUserId: context.actorUserId ?? null,
        authorName: input.authorName?.trim() || "Team",
        authorEmail: "",
        body: input.body.trim(),
        moderatedAt: new Date(),
        moderatedByUserId: context.actorUserId ?? null,
      },
    });
    await this.audit("discussion.reply", created.id, context, { parentId: parent.id });
    return created;
  }

  async deletePermanently(id: string, context: DiscussionMutationContext = {}): Promise<void> {
    await this.requireEntry(id);
    await this.database.discussionEntry.delete({ where: { id } });
    await this.audit("discussion.delete", id, context, { permanent: true });
  }

  async getSettings(sourceType: DiscussionSourceType, sourceId: string): Promise<DiscussionSettingsInput> {
    await this.requireSourceExists(sourceType, sourceId);
    const stored = await this.database.discussionSettings.findUnique({
      where: { sourceType_sourceId: { sourceType, sourceId } },
    });
    if (stored) {
      return {
        commentsEnabled: stored.commentsEnabled,
        reviewsEnabled: stored.reviewsEnabled,
        ratingEnabled: stored.ratingEnabled,
        verifiedPurchaseOnly: stored.verifiedPurchaseOnly,
        notifyOnNew: stored.notifyOnNew,
      };
    }
    return defaultSettings(sourceType);
  }

  async updateSettings(
    sourceType: DiscussionSourceType,
    sourceId: string,
    input: DiscussionSettingsInput,
    context: DiscussionMutationContext = {},
  ): Promise<DiscussionSettingsInput> {
    await this.requireSourceExists(sourceType, sourceId);
    const normalized: DiscussionSettingsInput = sourceType === "CONTENT"
      ? { ...input, reviewsEnabled: false, ratingEnabled: false, verifiedPurchaseOnly: false }
      : input;
    const saved = await this.database.discussionSettings.upsert({
      where: { sourceType_sourceId: { sourceType, sourceId } },
      update: normalized,
      create: { sourceType, sourceId, ...normalized },
    });
    await this.audit("discussion.settings.update", saved.id, context, { sourceType, sourceId });
    return {
      commentsEnabled: saved.commentsEnabled,
      reviewsEnabled: saved.reviewsEnabled,
      ratingEnabled: saved.ratingEnabled,
      verifiedPurchaseOnly: saved.verifiedPurchaseOnly,
      notifyOnNew: saved.notifyOnNew,
    };
  }

  private assertSubmissionAllowed(input: DiscussionSubmissionInput, settings: DiscussionSettingsInput): void {
    if (input.kind === "COMMENT" && !settings.commentsEnabled) {
      throw new AppError({ code: "DISCUSSION_COMMENTS_DISABLED", message: "Comments are disabled for this item", statusCode: 409 });
    }
    if (input.kind === "REVIEW") {
      if (input.sourceType !== "PRODUCT") {
        throw new AppError({ code: "DISCUSSION_REVIEW_SOURCE_INVALID", message: "Reviews are only supported for products", statusCode: 400 });
      }
      if (!settings.reviewsEnabled) {
        throw new AppError({ code: "DISCUSSION_REVIEWS_DISABLED", message: "Reviews are disabled for this product", statusCode: 409 });
      }
      if (settings.ratingEnabled && input.rating === undefined) {
        throw new AppError({ code: "DISCUSSION_RATING_REQUIRED", message: "A rating is required for this product review", statusCode: 400 });
      }
      if (!settings.ratingEnabled && input.rating !== undefined) {
        throw new AppError({ code: "DISCUSSION_RATING_DISABLED", message: "Ratings are disabled for this product", statusCode: 400 });
      }
      if (settings.verifiedPurchaseOnly) {
        throw new AppError({
          code: "DISCUSSION_VERIFIED_PURCHASE_REQUIRED",
          message: "This product only accepts verified-purchase reviews",
          statusCode: 403,
        });
      }
    }
  }

  private async requirePublicSource(sourceType: DiscussionSourceType, sourceId: string): Promise<void> {
    if (sourceType === "CONTENT") {
      const source = await this.database.contentEntry.findUnique({ where: { id: sourceId }, select: { status: true } });
      if (!source || source.status !== "PUBLISHED") {
        throw new AppError({ code: "DISCUSSION_SOURCE_NOT_FOUND", message: "Published content was not found", statusCode: 404 });
      }
      return;
    }
    await this.requireCatalogEnabled();
    const product = await this.database.product.findUnique({ where: { id: sourceId }, select: { status: true } });
    if (!product || product.status !== "ACTIVE") {
      throw new AppError({ code: "DISCUSSION_SOURCE_NOT_FOUND", message: "Active product was not found", statusCode: 404 });
    }
  }

  private async requireSourceExists(sourceType: DiscussionSourceType, sourceId: string): Promise<void> {
    if (sourceType === "PRODUCT") await this.requireCatalogEnabled();
    const exists = sourceType === "CONTENT"
      ? await this.database.contentEntry.count({ where: { id: sourceId } })
      : await this.database.product.count({ where: { id: sourceId } });
    if (exists !== 1) {
      throw new AppError({ code: "DISCUSSION_SOURCE_NOT_FOUND", message: "Discussion source was not found", statusCode: 404 });
    }
  }

  private async requireCatalogEnabled(): Promise<void> {
    const catalog = await this.database.moduleInstallation.findUnique({
      where: { name: "@beyondx/plugin-catalog" },
      select: { enabled: true },
    });
    if (!catalog?.enabled) {
      throw new AppError({
        code: "DISCUSSION_PRODUCT_SOURCE_UNAVAILABLE",
        message: "Product discussions are unavailable while the Catalog plugin is disabled",
        statusCode: 404,
      });
    }
  }

  private async requireEntry(id: string) {
    const entry = await this.database.discussionEntry.findUnique({ where: { id } });
    if (!entry) throw new AppError({ code: "DISCUSSION_ENTRY_NOT_FOUND", message: "Comment or review was not found", statusCode: 404 });
    return entry;
  }

  private async sourceLabels(sources: Array<{ sourceType: DiscussionSourceType; sourceId: string }>): Promise<Map<string, string>> {
    const contentIds = [...new Set(sources.filter((source) => source.sourceType === "CONTENT").map((source) => source.sourceId))];
    const productIds = [...new Set(sources.filter((source) => source.sourceType === "PRODUCT").map((source) => source.sourceId))];
    const [content, products] = await Promise.all([
      contentIds.length === 0
        ? Promise.resolve([])
        : this.database.contentEntry.findMany({
            where: { id: { in: contentIds } },
            select: { id: true, slug: true, contentType: { select: { name: true } } },
          }),
      productIds.length === 0
        ? Promise.resolve([])
        : this.database.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }),
    ]);
    const labels = new Map<string, string>();
    for (const entry of content) labels.set(sourceKey("CONTENT", entry.id), `${entry.contentType.name}: ${entry.slug}`);
    for (const product of products) labels.set(sourceKey("PRODUCT", product.id), product.name);
    return labels;
  }

  private async audit(
    action: string,
    targetId: string,
    context: DiscussionMutationContext,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.database.auditLog.create({
      data: {
        actorUserId: context.actorUserId ?? null,
        action,
        targetType: "discussion",
        targetId,
        requestId: context.requestId ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
}

function defaultSettings(sourceType: DiscussionSourceType): DiscussionSettingsInput {
  return sourceType === "PRODUCT"
    ? { commentsEnabled: false, reviewsEnabled: true, ratingEnabled: true, verifiedPurchaseOnly: false, notifyOnNew: true }
    : { commentsEnabled: true, reviewsEnabled: false, ratingEnabled: false, verifiedPurchaseOnly: false, notifyOnNew: true };
}

function toPublicSettings(settings: DiscussionSettingsInput): DiscussionSettingsInput {
  return { ...settings };
}

export interface PublicDiscussionEntry {
  id: string;
  sourceType: DiscussionSourceType;
  sourceId: string;
  kind: DiscussionKind;
  parentId: string | null;
  authorName: string;
  body: string;
  rating: number | null;
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies: PublicDiscussionEntry[];
}

interface PublicEntryShape {
  id: string;
  sourceType: DiscussionSourceType;
  sourceId: string;
  kind: DiscussionKind;
  parentId: string | null;
  authorName: string;
  body: string;
  rating: number | null;
  verifiedPurchase: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies?: PublicEntryShape[];
}

function toPublicEntry(entry: PublicEntryShape): PublicDiscussionEntry {
  const replies: PublicDiscussionEntry[] = entry.replies?.map(toPublicEntry) ?? [];
  return {
    id: entry.id,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    kind: entry.kind,
    parentId: entry.parentId,
    authorName: entry.authorName,
    body: entry.body,
    rating: entry.rating,
    verifiedPurchase: entry.verifiedPurchase,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    replies,
  };
}

function sourceKey(sourceType: DiscussionSourceType, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}
