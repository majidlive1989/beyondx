FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm db:generate
RUN pnpm build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
COPY --from=build --chown=node:node /app /app
RUN mkdir -p /app/storage/media && chown -R node:node /app/storage
USER node
EXPOSE 4000 3000
CMD ["sh", "-c", "pnpm db:migrate:deploy && pnpm --filter @beyondx/api start"]
