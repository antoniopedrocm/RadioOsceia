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

## Seed de desenvolvimento (manual rápido)

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

A camada antiga HTTP (`localhost:3333/api/v1`) foi substituída por integração Firebase:

- Leitura/escrita direta no Firestore para entidades simples.
- Criação de mídia YouTube salva direto em `media` com validação e parse da URL no cliente.
- Cálculo de `now-playing`, `up-next`, timeline e resumo de dashboard feito em runtime no cliente usando `scheduleBlocks` + `playbackSequences`.
- Auth admin via Firebase Authentication com perfil/autorização em `users/{uid}`.

## Legado

O diretório `backend/` (Fastify/Prisma/PostgreSQL) foi mantido apenas como legado temporário e **não é mais necessário** para executar a aplicação migrada.
