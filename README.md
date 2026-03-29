# Rádio / Web TV Institucional

Aplicação com frontend em React + TypeScript + Vite e backend em Fastify + Prisma + PostgreSQL.

## Visão geral

- `src/`: frontend público e administrativo.
- `backend/`: API REST em `/api/v1`, autenticação JWT, Prisma, uploads locais e dashboard.
- O frontend usa `VITE_API_URL` para descobrir a API.
- Se o backend estiver offline, a UI continua abrindo e exibe estados amigáveis de indisponibilidade em vez de quebrar a tela.

## Pré-requisitos

- Node.js 18+
- npm
- PostgreSQL

## Subindo o frontend

1. Instale as dependências na raiz do projeto:
   ```bash
   npm install
   ```
2. Crie o arquivo de ambiente a partir do exemplo:
   ```bash
   cp .env.example .env
   ```
3. Confira a URL da API no `.env`:
   ```env
   VITE_API_URL=http://localhost:3333/api/v1
   ```
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

Frontend por padrão: `http://localhost:5173`.

## Subindo o backend

1. Entre na pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Crie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
4. Revise as variáveis principais (`PORT`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`). No Prisma ORM v7, a URL do banco é lida em `backend/prisma.config.ts` (via `env("DATABASE_URL")`).
5. Gere o cliente do Prisma:
   ```bash
   npx prisma generate
   ```
6. Aplique o schema no banco. Use uma das opções abaixo:
   ```bash
   npx prisma migrate dev --name init
   ```
   ou
   ```bash
   npx prisma db push
   ```
7. Rode o seed:
   ```bash
   npm run prisma:seed
   ```
8. Inicie a API:
   ```bash
   npm run dev
   ```

Backend por padrão: `http://localhost:3333`.

## Fluxo local recomendado

1. Suba o backend em `http://localhost:3333`.
2. Suba o frontend em `http://localhost:5173`.
3. Navegue normalmente pela aplicação.
4. Se o backend não estiver ativo, a aplicação frontend continuará carregando e mostrará mensagens como:
   - "Servidor indisponível no momento"
   - "Não foi possível carregar os dados"
   - "Verifique se o backend está em execução"

## Credenciais de desenvolvimento

- Email: `admin@radioosceia.dev`
- Senha: `Admin@123456`

## Principais endpoints

- Auth: `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/me`
- Público: `/api/v1/public/institutions/:slug/*`
- Admin CRUD: `/api/v1/{institutions,users,presenters,categories,programs,media,schedule-items,playback-overrides}`
- Upload local: `/api/v1/media/upload/local`
- Dashboard: `/api/v1/dashboard/summary`
- Logs: `/api/v1/logs`
