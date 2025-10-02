# Chrona

Chrona is an offline-first companion for hourly professionals that captures every shift, highlights penalty windows, and keeps pay insights at your fingertips. The project uses React, Vite, Dexie (IndexedDB), and Tailwind CSS.

## Getting started

```bash
npm install
npm run dev
```

> [!NOTE]
> The project is configured for **npm 11.6.1** (see the `packageManager` field in `package.json`). If you're using Corepack, run `corepack enable` first to pick up the pinned version.

During `npm install` the post-install script attempts to download Playwright browsers. In restricted network environments the download may fail; when that happens the script will log a warning and continue so the rest of the installation completes. Once you have network access, rerun:

```bash
npx playwright install
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

## Backup & restore

- Open the **Backup** button in the header to launch the modal while the app is running.
- The **Download backup** action produces a `tar.gz` archive containing `meta.json`, `settings.json`, `shifts.json`, and `notifications.json`. Keep the window open until the download completes.
- Restoring requires selecting a `.tar.gz` archive from the modal. The file is validated before a Dexie transaction replaces existing tables and rebuilds notification schedules.
- Every export or restore logs human-readable messages. Review them inside the modal and use **Download log** to save a plain-text copy for troubleshooting.
- Backup compression relies on `@gera2ld/tarjs` for TAR packing/unpacking and `fflate` for gzip support.

## PWA notes

The app uses `vite-plugin-pwa` for service worker generation. Assets in `public/` supply install icons. Run `npm run build` to generate the service worker and manifest.

## Deployment

The sample Nginx configuration in `deploy/nginx.conf` is tuned for static hosting and now emits the following response headers:

- `Content-Security-Policy` locks scripts, styles, workers, and other active content to same-origin assets while allowing API calls to `https://date.nager.at` for the optional public-holiday lookup. If you proxy requests through a different host or rely on additional CDNs, extend the relevant directives (for example, `connect-src`).
- `X-Content-Type-Options: nosniff` prevents MIME-type sniffing on cached resources.
- `Referrer-Policy: no-referrer` strips outgoing referrers; tighten or relax as required by your analytics posture.
- `Permissions-Policy` disables unused browser capabilities such as camera, microphone, geolocation, and USB access. Remove specific directives only if a custom fork needs those APIs.
- `Strict-Transport-Security` is preconfigured with a one-year TTL. Browsers only honor it on HTTPS responses, so leave it enabled when Chrona is served over TLS and disable it if you terminate TLS elsewhere and prefer to manage HSTS upstream.

Because each cache-specific `location` block overrides inherited headers, the configuration duplicates the security directives to cover `/assets/`, `/sw.js`, and the SPA fallback. If you add more locations, remember to include the same header set.

## Project structure

The project follows the guidance from `AGENTS.md`. Core directories include:

- `src/app/logic` – pure TypeScript utilities with unit tests
- `src/app/db` – Dexie schema and data access helpers
- `src/app/routes` – page-level React components
- `src/app/components` – reusable UI components
- `src/tests/logic` – Vitest suites for domain logic
