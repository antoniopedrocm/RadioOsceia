# Rádio / Web TV Institucional

Projeto com frontend React + Vite existente e backend novo em Fastify + Prisma + PostgreSQL.

## Estrutura

- `src/`: frontend existente, agora integrado com API real para autenticação, home pública (now playing/up next/programas/apresentadores) e dashboard admin.
- `backend/`: API REST `/api/v1`, autenticação JWT, Prisma, upload local, playback resolver e auditoria.

## Backend

1. Instale dependências:
   ```bash
   cd backend
   npm install
   ```
2. Configure ambiente:
   ```bash
   cp .env.example .env
   ```
3. Execute migrações e seed:
   ```bash
   npx prisma migrate dev --name init
   npm run prisma:seed
   ```
4. Rode a API:
   ```bash
   npm run dev
   ```

## Frontend

1. Na raiz:
   ```bash
   npm install
   cp .env.example .env
   npm run dev
   ```

## Credenciais de desenvolvimento

- Email: `admin@radioosceia.dev`
- Senha: `Admin@123456` (ajustável via `SEED_ADMIN_PASSWORD`)

## Principais endpoints

- Auth: `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`
- Público: `/api/v1/public/institutions/:slug/*`
- Admin CRUD: `/api/v1/{institutions,users,presenters,categories,programs,media,schedule-items,playback-overrides}`
- Upload local: `/api/v1/media/upload/local`
- Dashboard: `/api/v1/dashboard/summary`
- Logs: `/api/v1/logs`
