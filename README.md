# Rádio / Web TV Institucional — Arquitetura Firebase

Aplicação com frontend em **React + TypeScript + Vite** e backend serverless em **Firebase**.

## Arquitetura final

- **Firebase Hosting**: entrega do frontend.
- **Firebase Authentication**: login administrativo (`admin` e `operador`).
- **Cloud Firestore**: persistência principal.
- **Cloud Functions**: regras de negócio (mídia YouTube, timeline, now playing, up next e resumo de dashboard).
- **Instituição ativa única**: **Irmão Áureo**.

## Modelagem no Firestore

- `settings/app`
- `users/{uid}`
- `programs/{programId}`
- `presenters/{presenterId}`
- `media/{mediaId}`
- `playbackSequences/{sequenceId}`
- `playbackSequences/{sequenceId}/items/{itemId}`
- `scheduleBlocks/{blockId}`
- `auditLogs/{logId}`

## Pré-requisitos

- Node.js 20+
- npm
- Firebase CLI (`npm i -g firebase-tools`)

## Configuração de ambiente

1. Instale dependências da raiz:
   ```bash
   npm install
   ```
2. Instale dependências das Functions:
   ```bash
   npm --prefix functions install
   ```
3. Crie o arquivo de ambiente:
   ```bash
   cp .env.example .env.local
   ```
4. Ajuste as chaves Firebase do seu projeto no `.env.local`.

## Rodando local com Firebase Emulator Suite

Em um terminal:

```bash
npm run dev
```

Em outro terminal:

```bash
npm run dev:emulators
```

UI do frontend: `http://localhost:5173`.
UI dos emuladores: `http://localhost:4000`.

## Seed de desenvolvimento

> Recomendado com emuladores ligados.

Execute o bootstrap inicial via callable function:

```bash
npm run seed:firebase
```

O seed cria:

- Configuração da instituição `Irmão Áureo`
- 1 admin e 1 operador
- Programa inicial
- Apresentador inicial
- Mídia YouTube de exemplo
- Sequência de reprodução
- Bloco de programação

## Credenciais de desenvolvimento

- **Admin**: `admin@irmaoaureo.dev` / `Admin@123456`
- **Operador**: `operador@irmaoaureo.dev` / `Operador@123456`

## Cloud Functions principais

- `createYoutubeMedia`
- `createPlaybackSequence`
- `saveScheduleBlock`
- `getNowPlaying`
- `getUpNext`
- `getTimeline`
- `getDashboardSummary`
- `bootstrapSeedData`

## Integração frontend

A camada antiga HTTP (`localhost:3333/api/v1`) foi substituída por integração Firebase:

- Leitura/escrita direta no Firestore para entidades simples.
- Chamada de Cloud Functions para lógica crítica (tocando agora/fila/timeline/dashboard e criação de mídia YouTube).
- Auth admin via Firebase Authentication com perfil/autorização em `users/{uid}`.

## Legado

O diretório `backend/` (Fastify/Prisma/PostgreSQL) foi mantido apenas como legado temporário e **não é mais necessário** para executar a aplicação migrada.
