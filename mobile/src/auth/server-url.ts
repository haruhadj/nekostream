/**
 * The base URL of the server this app talks to.
 *
 * Three layers, in precedence order:
 *  - a URL the user entered, in AsyncStorage — an override, and the source of
 *    truth across launches once set.
 *  - `extra.serverUrl` in app.json, baked in at build time. NekoStream is
 *    single-operator and self-hosted, so a build knows its own server; making
 *    every launch of every install ask for an address it already knows was
 *    friction with nothing behind it. Leave it out of app.json and the
 *    first-launch screen comes back on its own, which is what any other
 *    operator building this would get.
 *  - a module-level cache (`cached`) is the *synchronous* accessor everything
 *    else reads, because `getAuthClient()` and the api client both need the
 *    URL without awaiting. `loadServerUrl()` must run once at startup to
 *    populate it before anything calls `getServerUrl()`.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { apiRequest, setBaseUrl } from "@/api/client";
import type { HealthResponse } from "@/api/types";

const STORAGE_KEY = "nekostream:server-url";

/** Read once: app.json is frozen into the binary at build time. */
const DEFAULT_SERVER_URL: string | null = (() => {
  const configured = Constants.expoConfig?.extra?.serverUrl;
  return typeof configured === "string" && configured.trim()
    ? normalizeServerUrl(configured)
    : null;
})();

/** Whether this build ships a server, and so can skip the first-launch screen. */
export function getDefaultServerUrl(): string | null {
  return DEFAULT_SERVER_URL;
}

let cached: string | null = null;

/**
 * Synchronous accessor. Returns null until `loadServerUrl()` has resolved
 * once — callers behind the _layout.tsx gate can assume it is set.
 */
export function getServerUrl(): string | null {
  return cached;
}

/**
 * Call once at startup. Reads the stored URL into the cache and points the
 * api client at it, so the very first `apiRequest` after launch already
 * targets the right host.
 */
export async function loadServerUrl(): Promise<string | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  // A stored URL is an override and wins; otherwise the build's own server.
  cached = stored ?? DEFAULT_SERVER_URL;
  setBaseUrl(cached ?? "");
  return cached;
}

/**
 * Accepts what the operator typed and returns something fetchable: trims
 * trailing slashes and assumes `http://` when no scheme is given (a LAN
 * address like `192.168.1.20:3000` is the common case).
 */
export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

type SaveResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Validates a candidate URL by calling `GET /api/health` and checking it
 * answers as a NekoStream server, then persists it. On failure the api
 * client's base URL is restored to whatever it was, so a bad entry never
 * leaves the app pointed at a dead host.
 */
export async function validateAndSaveServerUrl(raw: string): Promise<SaveResult> {
  const url = normalizeServerUrl(raw);
  const previous = cached;

  setBaseUrl(url);
  const res = await apiRequest<HealthResponse>("/api/health", {
    fallbackError: "That server did not respond.",
  });

  if (!res.ok) {
    setBaseUrl(previous ?? "");
    return { ok: false, error: res.error };
  }
  if (res.data?.service !== "nekostream") {
    setBaseUrl(previous ?? "");
    return { ok: false, error: "That host is not a NekoStream server." };
  }

  await AsyncStorage.setItem(STORAGE_KEY, url);
  cached = url;
  return { ok: true, url };
}

/**
 * Drops the stored override, falling back to the build's own server. On a
 * build with no `extra.serverUrl` that leaves no server at all, which is what
 * sends the gate back to the first-launch screen.
 */
export async function clearServerUrl(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  cached = DEFAULT_SERVER_URL;
  setBaseUrl(DEFAULT_SERVER_URL ?? "");
}
