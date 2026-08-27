/**
 * Where the tracker credentials live on the device.
 *
 * This replaces the server's `account` table (`src/db/schema.ts`) and the
 * reads in `src/lib/tokens.ts`: the phone holds its own AniList and MAL
 * tokens, so nothing has to ask a server for them. It deliberately does *not*
 * live in the device SQLite database — a token is a secret, and SecureStore is
 * backed by the Android keystore where the database is only app-private files.
 *
 * Each field gets its own key rather than one JSON blob per provider, because
 * SecureStore warns above 2048 bytes per value and MAL's access and refresh
 * tokens are each long enough that the pair could cross it. Split, neither one
 * is close.
 *
 * The profile (id, display name, avatar) is *not* secret and goes to
 * AsyncStorage, so rendering "signed in as …" never touches the keystore.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import type { Provider } from "@shared/providers";

export type StoredTokens = {
  accessToken: string;
  /** MAL only — AniList issues none. */
  refreshToken: string | null;
  /** Epoch ms, or null when the provider didn't say. */
  expiresAt: number | null;
};

export type TrackerProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

/** SecureStore keys accept [A-Za-z0-9._-] only. */
const accessKey = (p: Provider) => `nekostream.${p}.access`;
const refreshKey = (p: Provider) => `nekostream.${p}.refresh`;
const expiryKey = (p: Provider) => `nekostream.${p}.expires`;
const profileKey = (p: Provider) => `nekostream:profile:${p}`;

export async function saveTokens(
  provider: Provider,
  tokens: StoredTokens
): Promise<void> {
  await SecureStore.setItemAsync(accessKey(provider), tokens.accessToken);

  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(refreshKey(provider), tokens.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(refreshKey(provider));
  }

  if (tokens.expiresAt) {
    await SecureStore.setItemAsync(
      expiryKey(provider),
      String(tokens.expiresAt)
    );
  } else {
    await SecureStore.deleteItemAsync(expiryKey(provider));
  }
}

export async function readTokens(
  provider: Provider
): Promise<StoredTokens | null> {
  const accessToken = await SecureStore.getItemAsync(accessKey(provider));
  if (!accessToken) return null;

  const refreshToken = await SecureStore.getItemAsync(refreshKey(provider));
  const rawExpiry = await SecureStore.getItemAsync(expiryKey(provider));
  const expiresAt = rawExpiry ? Number(rawExpiry) : null;

  return {
    accessToken,
    refreshToken,
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
  };
}

export async function clearTokens(provider: Provider): Promise<void> {
  await SecureStore.deleteItemAsync(accessKey(provider));
  await SecureStore.deleteItemAsync(refreshKey(provider));
  await SecureStore.deleteItemAsync(expiryKey(provider));
}

export async function saveProfile(
  provider: Provider,
  profile: TrackerProfile
): Promise<void> {
  await AsyncStorage.setItem(profileKey(provider), JSON.stringify(profile));
}

export async function readProfile(
  provider: Provider
): Promise<TrackerProfile | null> {
  const raw = await AsyncStorage.getItem(profileKey(provider));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TrackerProfile;
  } catch {
    // A corrupt value is not worth a crash on launch; the next sign-in
    // rewrites it.
    return null;
  }
}

export async function clearProfile(provider: Provider): Promise<void> {
  await AsyncStorage.removeItem(profileKey(provider));
}
