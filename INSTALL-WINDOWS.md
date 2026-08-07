# BeyondX Phase 1 — Windows installation

Open PowerShell in the directory containing the root `package.json`.

## 1. Create configuration

```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
notepad .env
```

Put the two different generated values into `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

## 2. Install and start infrastructure

```powershell
pnpm install --no-frozen-lockfile
docker compose up -d postgres redis mailpit
docker compose ps
```

Wait until PostgreSQL and Redis are healthy.

## 3. Prepare the database

```powershell
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

The Phase 1 migration already exists. Do not create another migration named `init`.

## 4. Verify

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Temporarily move `.env` before structural verification because deliverable ZIP files must not contain real environment files:

```powershell
Move-Item .env ..\BeyondX.env.backup
pnpm verify:phase1
Move-Item ..\BeyondX.env.backup .env
```

## 5. Run

```powershell
pnpm dev
```

Open:

```text
http://127.0.0.1:3000/login
http://127.0.0.1:4000/docs
http://127.0.0.1:8025
```

For separate terminals:

```powershell
pnpm exec dotenv -e .env -- pnpm --filter @beyondx/api dev
pnpm exec dotenv -e .env -- pnpm --filter @beyondx/admin dev
```
