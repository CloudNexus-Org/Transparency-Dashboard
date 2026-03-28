<!-- AI assisted development -->

# Sample data

The database is seeded via Prisma (`backend/prisma/seed.ts`). It creates:

- **Users**: `admin@example.com` (ADMIN), `client@example.com` (CLIENT) — password `ChangeMeNow!`
- **Projects**: `seed-project-alpha` (client has access), `seed-project-beta` (admin only)
- **Risk snapshot**: one historical row on Alpha for chart smoke-tests

To re-seed after schema changes:

```bash
cd backend
npx prisma migrate deploy
npm run db:seed
```

For live Microsoft Planner data, set `Project.plannerPlanId` to a real plan ID (Graph) and configure Graph authentication per `SETUP.md`.
