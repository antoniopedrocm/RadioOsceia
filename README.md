# Rádio / Web TV Institucional — Arquitetura Firebase

Aplicação com frontend em **React + TypeScript + Vite** com arquitetura **Firebase-only**.

## Arquitetura final

- **Firebase Hosting**: entrega do frontend.
- **Firebase Authentication**: login administrativo (`admin` e `operador`).
- **Cloud Firestore**: persistência principal.
- **Cálculo de timeline/now-playing/up-next no frontend** com base em dados do Firestore.
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
2. Crie o arquivo de ambiente:
   ```bash
   cp .env.example .env.local
   ```
3. Ajuste as chaves Firebase do seu projeto no `.env.local`.

## Rodando local com Firebase Emulator Suite

Em um terminal:

```bash
npm run dev
```

Em outro terminal (opcional para Auth/Firestore local):

```bash
npm run dev:emulators
```

UI do frontend: `http://localhost:5173`.
UI dos emuladores: `http://localhost:4000`.

## Seed de desenvolvimento

Fluxos oficiais de seed:

- Cloud Function callable `bootstrapSeedData` (recomendado para automatizar a carga inicial).
- Procedimento manual oficial no Firestore/Emulator UI (fallback).

> Não existe fluxo de produção via endpoint HTTP local como `/bootstrap/seed` no frontend.

### Procedimento manual (fallback)

No painel do Firestore (ou Emulator UI), crie os documentos mínimos abaixo:

- Configuração da instituição `Irmão Áureo` (`settings/app`)
- Programa inicial
- Apresentador inicial
- Mídia YouTube de exemplo
- Sequência de reprodução
- Bloco de programação

> Usuários `admin` e `operador` devem ser criados no **Firebase Authentication** e depois cadastrados em `users/{uid}` com `role: "admin"` ou `role: "operador"`.

## Credenciais de desenvolvimento

- **Admin**: `admin@irmaoaureo.dev` / `Admin@123456`
- **Operador**: `operador@irmaoaureo.dev` / `Operador@123456`

## Integração frontend

A aplicação utiliza integração Firebase em todas as operações:

- Leitura/escrita direta no Firestore para entidades simples.
- Criação de mídia YouTube salva direto em `media` com validação e parse da URL no cliente.
- Cálculo de `now-playing`, `up-next`, timeline e resumo de dashboard feito em runtime no cliente usando `scheduleBlocks` + `playbackSequences`.
- Auth admin via Firebase Authentication com perfil/autorização em `users/{uid}`.

## Deploy (separado por alvo)

O `firebase.json` mantém `functions`, `hosting` e `firestore` no mesmo repositório, mas o deploy pode ser separado por alvo para evitar publicar Cloud Functions quando o projeto GCP ainda não tem permissões (billing/App Engine/roles).

### Fluxo recomendado (frontend + firestore, sem Functions)

```bash
npm run deploy:web
```

Esse comando executa build do frontend e publica **somente** `hosting` + `firestore` (`--only hosting,firestore`).

Também é possível publicar individualmente:

```bash
npm run deploy:hosting
npm run deploy:firestore
```

### Deploy de Functions (quando a infraestrutura estiver pronta)

```bash
npm run deploy:functions
```

### Deploy completo (tudo)

```bash
npm run deploy:all
```

## Projetos Firebase (dev vs prod)

O `.firebaserc` define aliases:

- `default` / `dev` → `radio-osceia-dev`
- `prod` → `radioosceia`

Exemplos:

```bash
npm run deploy:web -- --project dev
npm run deploy:web -- --project prod
# ou: npm run deploy:web -- --project radioosceia
```

`.env.example` continua apontando para `radio-osceia-dev` (desenvolvimento). Para produção, use as chaves do projeto `radioosceia` no seu arquivo de ambiente de build/deploy.
