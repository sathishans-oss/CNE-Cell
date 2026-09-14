# AIIMS CNE Management System

## Deployment Architecture

### Production Platform: Cloudflare Pages
* **Frontend**: Static SPA compiled by Vite to `dist/`, deployed on Cloudflare Pages.
* **Production API**: Cloudflare Pages Functions located in the `functions/` directory.
  - **Production AI Endpoint**: `functions/api/ai/generate-questions.ts` serving `POST /api/ai/generate-questions`
  - **Production Health Check**: `functions/api/health.ts` serving `GET /api/health`

### Local Development: Express + Vite
* **Local Development Server**: `server.ts` executed via `npm run dev`.
* Serves the local development frontend via Vite middleware on port 3000 and emulates `/api/ai/generate-questions` and `/api/health` with identical validation, quota, and clinical retrieval contracts.

## Key Build & Validation Commands

* `npm install`: Installs dependencies.
* `npm run sync:gas`: Synchronizes authoritative `Code.gs` into `src/backend/googleAppsScript.ts`.
* `npm run lint`: Performs full TypeScript static verification (`tsc --noEmit`).
* `npm run build`: Builds the production bundle.
* `npm run dev`: Boots local development server (`tsx server.ts`).

## Production Configuration

* **GEMINI_API_KEY**: Secret binding for Google Gemini API access.
* **GEMINI_MODEL**: AI model configuration (e.g. `gemini-2.5-flash`). Paid-tier models (`gemini-pro`, `gemini-1.5-pro`, `gemini-2.0-pro`) are strictly prohibited.
* **VITE_APPS_SCRIPT_URL**: Google Apps Script web app endpoint for CNE data persistence.
