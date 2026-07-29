/**
 * Applies pending migrations before the server starts, so a fresh volume comes
 * up with a working schema and no manual drizzle-kit step.
 */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:./nekostream.db";

const client = createClient({ url });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log(`[nekostream] migrations applied (${url})`);
} catch (error) {
  console.error("[nekostream] migration failed:", error);
  process.exit(1);
} finally {
  client.close();
}
