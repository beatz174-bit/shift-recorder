# AGENTS.md — Time Tracker PWA (Clock-In/Clock-Out)

This document instructs Codex agents how to build, extend, and maintain a **free, offline-first PWA** for tracking shifts and calculating pay. It encodes standards, non-negotiable constraints, architecture, and acceptance criteria.

---

## 1) Product Summary

A **single-user** time tracking Progressive Web App (PWA) that runs entirely **on-device** (no backend). It supports:

* **Clock in / clock out** (start/stop a running shift)
* Manual add/edit of shifts (start & finish datetime)
* **Two pay rates**:

  * **Base rate** (default)
  * **Penalty rate**:

    * Entire **weekend** (Saturday & Sunday)
    * **00:00–07:00** on weekdays
* A **Summary** page for **current week** with navigation to previous/next weeks
* A **Shifts** page listing per-shift details (date, start, finish, total hours, base vs penalty split, total pay)
* A **Settings** page to set **base rate**, **penalty rate**, and **week start day** (Mon/Sun)
* Fully offline; data persisted to **IndexedDB**

**Non-Goals**

* No authentication, user accounts, server components, or multi-user features
* No external analytics or trackers
* No payroll exports beyond CSV

---

## 2) Tech Stack (pinned & rationale)

* **App**: React 18 + TypeScript
* **Build**: Vite
* **Routing**: React Router
* **Storage**: IndexedDB via **Dexie.js**
* **Date/Time**: **date-fns** (+ optional date-fns-tz if needed)
* **PWA**: **vite-plugin-pwa** (service worker + manifest + offline caching)
* **Styling**: Tailwind CSS (lightweight, fast iteration). Keep design minimal and accessible.
* **Tests**: Vitest + React Testing Library; Playwright for minimal E2E
* **Lint/Format**: ESLint (typescript-eslint) + Prettier
* **Type Safety**: `strict: true` in tsconfig

> Agents MUST keep dependency count lean and avoid heavy UI kits unless explicitly requested.

---

## 3) Project Structure

```
time-tracker-pwa/
  ├─ src/
  │  ├─ app/
  │  │  ├─ routes/                # route components
  │  │  │  ├─ SummaryPage.tsx
  │  │  │  ├─ ShiftsPage.tsx
  │  │  │  └─ SettingsPage.tsx
  │  │  ├─ components/            # reusable UI
  │  │  │  ├─ ShiftCard.tsx
  │  │  │  ├─ ShiftForm.tsx
  │  │  │  └─ WeekNavigator.tsx
  │  │  ├─ db/                    # Dexie schema + CRUD
  │  │  │  ├─ schema.ts
  │  │  │  └─ repo.ts
  │  │  ├─ logic/                 # pure functions (unit-tested)
  │  │  │  ├─ payRules.ts
  │  │  │  ├─ splitIntervals.ts
  │  │  │  └─ week.ts
  │  │  ├─ state/                 # Settings context
  │  │  │  └─ SettingsContext.tsx
  │  │  ├─ pwa/                   # PWA setup
  │  │  │  ├─ registerSW.ts
  │  │  │  └─ manifest.webmanifest
  │  │  ├─ styles/
  │  │  │  └─ index.css
  │  │  └─ main.tsx
  │  ├─ tests/
  │  │  ├─ logic/
  │  │  │  └─ payRules.test.ts
  │  │  └─ e2e/
  │  │     └─ smoke.spec.ts
  │  └─ vite-env.d.ts
  ├─ public/                      # icons, favicon, robots
  ├─ index.html
  ├─ tsconfig.json
  ├─ vite.config.ts
  ├─ tailwind.config.js
  ├─ postcss.config.js
  ├─ package.json
  ├─ .eslintrc.cjs
  ├─ .prettierrc
  └─ README.md
```

---

## 4) Data Model & Persistence (Dexie)

### Types

```ts
// Settings are singletons (id='singleton'), but Dexie schema allows migrations later.
export type WeekStart = 0 | 1; // 0=Sunday, 1=Monday

export interface Settings {
  id: 'singleton';
  baseRate: number;        // per hour
  penaltyRate: number;     // per hour
  weekStartsOn: WeekStart; // user preference
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}

export interface Shift {
  id: string;        // uuid
  start: string;     // ISO (local time captured via new Date()) 
  end: string;       // ISO
  // cached/derived at save-time (recomputed on edits or settings changes)
  baseHours: number;
  penaltyHours: number;
  totalPay: number;
  weekStartISO: string;  // yyyy-mm-dd at local midnight of configured week start
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Dexie Schema

* DB name: `time-tracker`
* Version 1 stores:

  * `settings` (key: id)
  * `shifts` (index by `weekStartISO`, `start`)

**Migration rules**: future versions MUST write Dexie upgrades; never destructive without a migration function.

---

## 5) Time & Pay Calculation (authoritative rules)

1. **Penalty** time comprises:

   * Entire **Saturday** and **Sunday**
   * **00:00–07:00** on **Monday–Friday**
2. All other times are **Base**.
3. Shifts may **cross midnight**. Logic must split by **day boundary**, then apply day-specific windows.
4. Computation is done in **local time**. (User is in Australia/Brisbane, no DST; still keep it generic.)
5. Week start is configurable (**Sunday or Monday**) and used to:

   * Normalize a `weekStartISO` key (local midnight)
   * Drive Summary range selection

### API (pure functions)

```ts
// Given start/end (Date), returns normalized segments per day with base & penalty hours
function splitIntoDailySegments(start: Date, end: Date): Array<{
  dateISO: string;           // yyyy-mm-dd
  baseHours: number;
  penaltyHours: number;
}>;

// Apply rate settings to compute totals; never mutate inputs
function computePayForShift(params: {
  startISO: string;
  endISO: string;
  baseRate: number;
  penaltyRate: number;
}): {
  totalHours: number;
  baseHours: number;
  penaltyHours: number;
  totalPay: number;
};

// Normalize given a week start (0=Sun,1=Mon)
function getWeekStartLocal(date: Date, weekStartsOn: 0 | 1): Date;

// Return [startOfWeek, endOfWeekExclusive]
function getWeekRange(date: Date, weekStartsOn: 0 | 1): { start: Date; end: Date };
```

**Implementation constraints**

* No floating-point drift in totals: use minutes as integers internally; convert to hours at the end (`minutes / 60`), rounding to 2 decimals only for display.
* All pure functions must be **unit-tested** with edge cases:

  * Entirely inside penalty window
  * Crossing 07:00 boundary
  * Crossing midnight
  * Weekend + overnight spans
  * Very short shifts (e.g., 5 min)
  * Start == End (reject)

---

## 6) App Behavior

* **Clock In**:

  * If no active shift, create shift with `start=now()`, **no** `end`.
  * A single floating **primary button** toggles between “Clock In” and “Clock Out”.
* **Clock Out**:

  * Set `end=now()`. If `end <= start`, show validation error.
  * Compute hours & pay with current settings and persist cached fields.
* **Manual Add/Edit**:

  * Allow setting start/end with datetime pickers.
  * Upon save: recompute derived fields and persist.
* **Settings Changes**:

  * When base/penalty rate or week start day changes, **recompute all cached fields** for existing shifts. Use a batched Dexie transaction.

---

## 7) Pages & UX

### SummaryPage

* Shows **current week** totals: total hours, base hours, penalty hours, total pay.
* Simple **week navigator**: `« Prev | This Week | Next »`
* Empty state: prompt to clock in or add a shift.

### ShiftsPage

* List of shifts in the selected week (default: current week), newest first.
* Each item shows: Date (weekday), Start–End (hh:mm), total hours, base/penalty split, total pay.
* Tapping an item opens edit.
* Add button opens new shift form with default times (now & now+1h).

### SettingsPage

* Inputs for: **Base Rate (per hour)**, **Penalty Rate (per hour)**, **Week Start** (Mon/Sun).
* Validate numeric rates ≥ 0.
* Persist immediately (debounced) and trigger recompute.

**Accessibility**

* All controls keyboard accessible, proper labels, and sufficient contrast. Use semantic HTML elements and ARIA where needed. Ensure tap targets ≥ 44px.

---

## 8) PWA Requirements

* Installable on Android (manifest with name, icons, `display: standalone`, theme/background color).
* Offline: cache shell + static assets via `vite-plugin-pwa` with a Workbox strategy (`StaleWhileRevalidate` for static; never cache HTML endlessly).
* Update flow: when a new SW is available, show a **toast** “Update available” → “Reload”.

---

## 9) Quality Gates

* **TypeScript**: `strict: true`, no `any` unless justified with comments.
* **ESLint**: `eslint:recommended`, `plugin:react/recommended`, `@typescript-eslint/recommended`, `react-hooks/rules-of-hooks`.
* **Prettier**: enforce formatting.
* **Unit Tests**: ≥ 90% coverage for `logic/` pure functions.
* **E2E**: Playwright smoke test:

  * Can add a shift
  * Can clock in/out
  * Summary shows correct totals for a known scenario
* **Performance**: Lighthouse PWA passes; First load JS < 200KB gz if feasible.
* **Bundle**: avoid unnecessary deps.

---

## 10) Commands (npm scripts)

```
dev        # Vite dev server
build      # Production build
preview    # Preview built app
test       # Vitest unit tests
test:ui    # Vitest UI (optional)
e2e        # Playwright tests (headed/CI variants ok)
lint       # ESLint
format     # Prettier write
typecheck  # tsc --noEmit
```

---

## 11) CI (GitHub Actions example)

* On PR: `typecheck`, `lint`, `test`, `build`
* On main: `build` + upload artifact
* Optional: deploy to static hosting (e.g., GitHub Pages, Netlify). No secrets required.

---

## 12) Security & Privacy

* No network requests by default.
* All data local to IndexedDB.
* Provide **Export CSV** of shifts for backup; **Import** optional.
* Guard against accidental data loss on PWA updates (no schema resets).

---

## 13) Error Handling & Validation

* Prevent saving a shift with `end <= start`.
* Show non-blocking toasts for validation errors.
* Provide an “Undo” option for deletion for 5–10 seconds.

---

## 14) Internationalization & Currency

* Out of scope initially; display currency symbol from Settings (default `$`). Format with `Intl.NumberFormat` using user locale.

---

## 15) Developer Guidelines

* **Pure logic** in `logic/` with **unit tests first** (TDD encouraged).
* UI components stay **dumb** where possible; orchestration in pages.
* Keep components small (<200 LoC recommended).
* Use **Context** only for Settings; pass other data via props or local state.
* Avoid date math in components; rely on tested utils.

---

## 16) Acceptance Criteria (template)

> **Feature**: *e.g., Clock Out flow*
>
> * Given an active shift (start set, no end), when pressing **Clock Out**, then:
>
>   * `end` is set to now (local time)
>   * `computePayForShift` runs and stores `baseHours`, `penaltyHours`, `totalPay` in the shift
>   * `weekStartISO` updated according to current `Settings.weekStartsOn`
>   * Summary totals reflect the new shift
>   * Unit tests cover:
>
>     * Crossing 07:00 on a weekday
>     * Overnight weekday→weekday
>     * Overnight weekend cases

---

## 17) Sample Logic Specification

```ts
// splitIntervals.ts
// Split [start,end) at all midnight boundaries into daily windows.
// Return minutes, not hours, to avoid FP drift.
export function splitIntoDailySegments(start: Date, end: Date): Array<{
  dateISO: string;          // yyyy-mm-dd local
  minutes: number;          // total minutes in this day window
  minutesPenalty: number;   // minutes within 00:00–07:00 OR weekend
  minutesBase: number;      // minutes - minutesPenalty
}> {
  // Implementation must:
  // 1) Iterate from start to end, cutting at local midnight boundaries
  // 2) For weekdays, compute overlap with [00:00, 07:00)
  // 3) For Sat/Sun, entire minutes count as penalty
  // 4) Sum minutesPenalty & minutesBase; assert minutes=minutesPenalty+minutesBase
}
```

```ts
// payRules.ts
export function computePayForShift({
  startISO, endISO, baseRate, penaltyRate,
}: {
  startISO: string; endISO: string; baseRate: number; penaltyRate: number;
}) {
  // Convert to Date, validate end>start
  // Use splitIntoDailySegments; sum minutes across days
  // Return hours to 4 decimals (internal), UI rounds to 2
}
```

**Unit Tests** MUST include:

* 06:30–07:30 on Tue → 30 min penalty, 30 min base
* Fri 23:00 → Sat 03:00 → Fri 23:00–24:00 base (except 00–07 logic doesn’t apply cross-day), Sat 00:00–03:00 penalty
* Sat 22:00 → Sun 06:00 all penalty
* Mon 06:50 → 07:10 → 10 min penalty, 10 min base
* Start==End → invalid

---

## 18) UI/UX Guidelines

* Minimal, readable typography; avoid clutter.
* Primary FAB toggles **Clock In/Out** on all main pages.
* Summary uses large figures with small labels; Shifts use concise cards.
* Date/time pickers: default to local time; input masks where helpful.
* Respect system dark mode (prefers-color-scheme) if trivial to implement.

---

## 19) Performance

* Code-split routes.
* Avoid re-render storms; memoize derived values.
* Ensure SW doesn’t over-cache; clean up old caches on activation.

---

## 20) Definition of Done (DoD)

* All logic functions unit-tested with edge cases
* Lint, typecheck, tests, and build pass locally and in CI
* Lighthouse PWA passes; installable on Android
* Basic E2E smoke passes (add/edit/clock in/out affects Summary)
* README updated with run/build instructions
* No console errors/warnings in production build

---

## 21) Future Enhancements (not now)

* Quick actions/shortcuts widget for Android (Capacitor or Native)
* Overtime bands
* Data sync/backup to user’s Drive (opt-in)
* Import/export JSON with schema version

---

### Final Notes to Agents

* Keep business logic **pure and testable**; UI is a thin layer.
* Prefer **minutes** for internal math; convert to hours for display.
* Any change to settings must **recompute cached fields** for all shifts inside a single Dexie transaction to keep data consistent.
* Do not introduce external services or paid dependencies.

**Build it simple, fast, and reliable.**

