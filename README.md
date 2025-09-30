# Shift Recorder

Shift Recorder is an offline-first Progressive Web App for tracking shifts, splitting base vs penalty hours, and calculating pay without a backend. The project uses React, Vite, Dexie (IndexedDB), and Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

The development server runs at http://localhost:5173.

## Available scripts

- `npm run dev` – start the Vite development server
- `npm run build` – type-check and generate a production build
- `npm run preview` – preview the production build locally
- `npm run test` – run unit tests with Vitest
- `npm run lint` – run ESLint on the source tree
- `npm run typecheck` – run the TypeScript compiler without emitting files

## Testing

Unit tests focus on pay rules and schedule logic. Add Playwright tests under `src/tests/e2e` as the UI evolves.

## PWA notes

The app uses `vite-plugin-pwa` for service worker generation. Assets in `public/` supply install icons. Run `npm run build` to generate the service worker and manifest.

## Project structure

The project follows the guidance from `AGENTS.md`. Core directories include:

- `src/app/logic` – pure TypeScript utilities with unit tests
- `src/app/db` – Dexie schema and data access helpers
- `src/app/routes` – page-level React components
- `src/app/components` – reusable UI components
- `src/tests/logic` – Vitest suites for domain logic

