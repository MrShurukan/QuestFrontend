# QuestFrontend

React frontend for the Enigma quest backend.

## Stack

- `React 19`
- `TypeScript`
- `Vite`
- `React Router`
- `TanStack Query`
- `Tailwind CSS`
- `React Hook Form + Zod`
- `Framer Motion`
- `Vitest + Testing Library`
- `Playwright`

## App Shape

One SPA with three zones:

- `Public`: landing, role chooser, quest status, login entrypoints, QR orchestration
- `Player`: teams, known questions, answer flow, cooldowns, Enigma screen
- `Admin`: configuration CRUD, routing preview, lifecycle controls, support tools, audit

## Backend Integration

- All browser requests use cookie auth with `credentials: 'include'`.
- In development Vite proxies:
  - `/api`
  - `/health`
  - `/openapi`
- The frontend owns browser route `/q/:slug`.
- QR resolution JSON is loaded from backend API `/api/public/qr/{slug}`.
- Backend dynamic auth prefers admin cookie over participant cookie. For parallel admin/player work, use separate browser profiles or logout first.

## Quick Start

1. Install dependencies:

```powershell
npm install
```

2. Copy environment template:

```powershell
Copy-Item .env.example .env
```

3. Start backend in the sibling repo:

```powershell
docker compose up -d
dotnet ef database update --project src/QuestBackend.Infrastructure --startup-project src/QuestBackend.Api
dotnet run --project src/QuestBackend.Api
```

4. Start frontend:

```powershell
npm run dev
```

5. Open:

- frontend: `http://localhost:5173`
- backend: `http://localhost:5175`

## Useful Scripts

```powershell
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e
```

## Default Dev Access

- admin login: `admin / admin123`
- participant login: use `Player Login` and any dev subject/name

## Folder Highlights

- `src/app`: router, layout shells, app providers
- `src/features/public`: public pages and QR state mapping
- `src/features/player`: team, questions, answers, Enigma
- `src/features/admin`: admin CRUD, lifecycle, support, audit
- `src/shared/api`: typed API client
- `src/shared/contracts`: mirrored backend DTO types
- `src/shared/theme`: light/dark/system theme support
- `src/test`: Vitest setup
- `docs/runbook.md`: local operational notes

## Verification

The project is expected to pass:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
```
