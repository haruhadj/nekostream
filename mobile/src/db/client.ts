import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

import * as schema from "./schema";

export const DATABASE_NAME = "nekostream.db";

/**
 * `enableChangeListener` is what makes drizzle's `useLiveQuery` work. It costs
 * a `sqlite3_update_hook` and is the difference between a screen re-rendering
 * when a write lands and every screen needing to know who else might write —
 * the mobile counterpart of the web's `router.refresh()`.
 */
const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

/**
 * SQLite disables foreign keys per connection, so `onDelete: "cascade"` in
 * the schema is inert without this. Deleting a library entry has to take its
 * saved filter and its episodes with it — on the server that is the database's
 * job, and it stays the database's job here.
 */
sqlite.execSync("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

/** The raw handle, for the migrator and for pragmas. Prefer `db`. */
export const sqliteDb = sqlite;
