import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/auth/context";
import { theme } from "@/theme";
import { Button } from "@/ui/button";
import { Screen, ScreenTitle, SCREEN_PADDING } from "@/ui/screen";

/**
 * Account and server, plus the two ways out of both.
 *
 * Deliberately small for now: this is where the Phase 3 sign-out and
 * change-server controls belong once the placeholder landing screen they lived
 * on is replaced by the tab bar, and leaving them unreachable in the meantime
 * would be a regression. The notification email, the Stremio addon and the
 * MyAnimeList link are Phase 5, against `GET/PATCH /api/settings`.
 */
export default function SettingsScreen() {
  const { serverUrl, session, signOut, changeServer } = useAuth();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenTitle title="Settings" />

        <View style={styles.card}>
          <Field label="Signed in as" value={session?.user.name ?? "Unknown"} />
          <View style={styles.divider} />
          <Field label="Server" value={serverUrl ?? "Not set"} />
        </View>

        <View style={styles.actions}>
          <Button
            label="Change server"
            variant="outline"
            onPress={() => void changeServer()}
          />
          <Button label="Sign out" variant="ghost" onPress={() => void signOut()} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_PADDING, paddingBottom: 32 },
  card: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  divider: { height: 1, backgroundColor: theme.color.border },
  field: { paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  fieldLabel: { color: theme.color.muted, fontSize: 12 },
  fieldValue: { color: theme.color.foreground, fontSize: 15, fontWeight: "600" },
  actions: { marginTop: 20, gap: 10 },
});
