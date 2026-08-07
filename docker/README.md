# BeyondX Docker

The root `docker-compose.yml` starts PostgreSQL, Redis, Mailpit, the Fastify API and the Next.js Admin application.

```bash
docker compose up -d --build
```

Development ports:

- Admin: `3000`
- API: `4000`
- PostgreSQL: `5432`
- Redis: `6379`
- SMTP: `1025`
- Mailpit UI: `8025`

The API container waits for PostgreSQL, Redis and Mailpit health checks, deploys checked-in Prisma migrations and then starts the compiled API. The Admin container waits for the API health check.
