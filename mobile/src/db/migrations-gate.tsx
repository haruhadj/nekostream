/**
 * Applies pending device migrations before anything else renders.
 *
 * This is the phone's counterpart of `docker-entrypoint.sh` running
 * `npm run db:migrate` on every container boot: migrations are bundled with
 * the app (see `drizzle.config.ts`) and applied at launch, so an update that
 * adds a column finds the database ready rather than a screen finding it
 * missing.
 *
 * A failure here is shown, not swallowed. Every screen in this app is about to
 * read from that database, and "empty library" is precisely the wrong way to
 * report "the schema never applied" — the same reasoning as the auth gate
 * surfacing a revoked token rather than rendering nothing.
 */

import type { ReactNode } from "react";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { theme } from "@/theme";

import { db } from "./client";
import migrations from "../../drizzle/migrations";

export function MigrationsGate({ children }: { children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Database setup failed</Text>
        <Text style={styles.errorBody}>{error.message}</Text>
        <Text style={styles.errorHint}>
          Reinstalling the app clears the device database and runs the
          migrations from scratch. Anything only stored here — saved Nyaa
          filters and discovered releases — is lost with it.
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.color.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: theme.color.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: theme.color.danger,
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  errorBody: {
    marginTop: 10,
    color: theme.color.foreground,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorHint: {
    marginTop: 18,
    color: theme.color.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
