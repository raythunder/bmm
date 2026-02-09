# Repository Guidelines

## Project Structure & Module Organization
Core application code lives in `src/`:
- `src/app/`: Next.js App Router pages, route groups, and API routes.
- `src/components/`: shared UI and page-level components.
- `src/controllers/`: request/business logic for bookmark, tag, and auth flows.
- `src/db/`: database drivers, schemas, and SQLite migrations.
- `src/lib/`, `src/utils/`, `src/hooks/`: shared libraries, helpers, and hooks.

Tests are mainly in `tests/` (with DB-focused cases in `tests/db/`), with occasional colocated tests such as `src/db/zod.test.ts`. Static files are in `public/`; docs/images are in `doc/`; operational scripts are in `scripts/`.

## Build, Test, and Development Commands
- `pnpm install`: install dependencies (Node `>=24`, pnpm `10`).
- `pnpm dev`: initialize local DB, then run Next.js dev server.
- `pnpm build`: initialize DB in production mode, then build.
- `pnpm start`: start production server.
- `pnpm lint`: run Next.js ESLint checks.
- `pnpm test`: run Vitest test suite.
- `pnpm db:test`: verify database connectivity.
- `pnpm db:migrate` / `pnpm db:push`: run migrations or push schema.

Use `-P` (or `--production`) with DB scripts when targeting production env values.

## Coding Style & Naming Conventions
Use TypeScript-first, strict, and keep modules focused (single responsibility). Formatting follows the project Prettier config: 2 spaces, single quotes, no semicolons, trailing commas (`es5`), max line width 100.

Follow existing naming patterns:
- React components: `PascalCase.tsx` (for example `TagListPage.tsx`).
- Controllers: `Entity.controller.ts` (for example `UserTag.controller.ts`).
- Utility modules: concise kebab/camel naming, consistent with nearby files.
- Prefer path alias imports like `@/...` and `@cfg`.

## Testing Guidelines
Testing uses Vitest (`vitest.config.ts`). Name tests `*.test.ts`. Put integration-style DB tests under `tests/db/`; keep unit tests near related modules when helpful.

Before opening a PR, run:
- `pnpm lint`
- `pnpm test`

Add or update tests for behavior changes, especially around controllers, DB queries, and response helpers.

## Commit & Pull Request Guidelines
History favors Conventional Commits (`feat:`, `fix:`, `refactor:`, `build:`, `chore:`), optionally scoped (for example `fix(next.config.js): ...`).

PRs should include:
- clear problem/solution summary,
- linked issue (if any),
- test evidence (commands run),
- screenshots or GIFs for UI/admin changes.

Keep changes small, avoid unrelated refactors, and sync docs (`README.md`, `doc/`) whenever commands, env vars, or user-visible behavior change.
