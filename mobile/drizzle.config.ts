import type { Config } from "drizzle-kit";

/**
 * The device database's migration config — the counterpart of the repo root's
 * `drizzle.config.ts`, which targets the server's libSQL file.
 *
 * `driver: "expo"` is the whole difference: alongside the usual `.sql` files
 * and `meta/`, drizzle-kit emits `drizzle/migrations.js`, which imports every
 * `.sql` file so they can be bundled into the app and applied at launch (see
 * `src/db/migrations-gate.tsx`). There is no `dbCredentials` because nothing
 * here connects to a database — the migrations run on the phone.
 *
 * Per AGENTS.md, files under `drizzle/` are generated and never hand-edited.
 * That rule now applies in two places: run `npm run db:generate` in `mobile/`
 * after changing `src/db/schema.ts`.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo",
} satisfies Config;
