# QuestFrontend Runbook

## Local Environment

1. Install dependencies:

```powershell
npm install
```

2. Copy env template:

```powershell
Copy-Item .env.example .env
```

3. Ensure backend is running on `http://localhost:5175`.

4. Start Vite:

```powershell
npm run dev
```

## Important Routes

- public landing: `/`
- player login: `/player/login`
- admin login: `/admin/login`
- QR browser route: `/q/:slug`
- quest status: `/quest-status`

## Proxy Notes

The frontend talks to the backend through Vite proxy:

- `/api`
- `/health`
- `/openapi`

QR resolution uses backend API `/api/public/qr/:slug` through the same `/api` proxy.

## Auth Notes

- Browser requests must include cookies.
- Admin cookie has priority over participant cookie in backend dynamic auth.
- For reliable testing of two roles at once, use separate browser profiles or incognito windows.

## Suggested Backend Startup

From the backend repo:

```powershell
docker compose up -d
dotnet ef database update --project src/QuestBackend.Infrastructure --startup-project src/QuestBackend.Api
dotnet run --project src/QuestBackend.Api
```

Optional sample data:

```powershell
$env:Bootstrap__SeedSampleData="true"
dotnet run --project src/QuestBackend.Api
```

## Test Commands

```powershell
npm run test
npm run test:coverage
npm run test:e2e
```

## E2E Notes

- Default Playwright base URL is `http://127.0.0.1:5173`.
- Override when needed:

```powershell
$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:4173"
npm run test:e2e
```

## QR Integration Status

The browser route `/q/:slug` is owned by the frontend. Backend QR resolution is now exposed separately at `/api/public/qr/{slug}`, so the previous route collision is removed.
