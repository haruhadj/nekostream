/**
 * One provider for the whole app-entry gate: server URL first, then session.
 * `_layout.tsx` reads `status` off this and renders the matching branch of
 * the `Stack.Protected` tree.
 *
 * Session state is managed imperatively (getSession / signIn / signOut on the
 * lazily-built client) rather than via the client's `useSession` hook,
 * because the client does not exist until a server URL is set and is rebuilt
 * if that URL changes — a hook bound to a specific client instance would be
 * the wrong shape for that lifecycle.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { getAuthClient } from "./client";
import {
  clearServerUrl,
  getDefaultServerUrl,
  getServerUrl,
  loadServerUrl,
  validateAndSaveServerUrl,
} from "./server-url";

type AuthClient = ReturnType<typeof getAuthClient>;
type Session = NonNullable<
  Awaited<ReturnType<AuthClient["getSession"]>>["data"]
>;

/**
 * - `loading`  — reading stored state at startup
 * - `no-server`  — no server URL, or the user asked to change it
 *                  -> server-url.tsx
 * - `no-session` — server known, not signed in -> login.tsx
 * - `ready`  — signed in -> the app
 *
 * On a build with `extra.serverUrl` baked in, `no-server` is only ever reached
 * deliberately, via `changeServer()` — first launch goes straight to login.
 */
export type AuthStatus = "loading" | "no-server" | "no-session" | "ready";

type AuthValue = {
  status: AuthStatus;
  serverUrl: string | null;
  session: Session | null;
  /** Validate + persist a server URL. Returns an error string on failure. */
  setServer: (raw: string) => Promise<string | null>;
  /** Open the AniList consent flow in the system browser. */
  signIn: () => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Drop any override and open the server screen to enter a new one. */
  changeServer: () => Promise<void>;
  /** Back out of `changeServer()` without entering anything. */
  cancelServerChange: () => Promise<void>;
  /** Whether this build has a server to fall back on, so the change is cancellable. */
  defaultServerUrl: string | null;
};

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  // Tracked separately from "there is no server URL", because with a baked-in
  // default there always is one — the server screen then has to be something
  // the user asks for rather than something an empty value implies.
  const [changingServer, setChangingServer] = useState(false);

  /** Re-read the session from the server for the current URL. */
  const refreshSession = useCallback(async () => {
    if (!getServerUrl()) {
      setSession(null);
      setStatus("no-server");
      return;
    }
    const { data } = await getAuthClient().getSession();
    setSession(data ?? null);
    setStatus(data ? "ready" : "no-session");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const url = await loadServerUrl();
      if (cancelled) return;
      setServerUrlState(url);
      if (!url) {
        setStatus("no-server");
        return;
      }
      await refreshSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSession]);

  const setServer = useCallback(
    async (raw: string): Promise<string | null> => {
      const result = await validateAndSaveServerUrl(raw);
      if (!result.ok) return result.error;
      setServerUrlState(result.url);
      setChangingServer(false);
      await refreshSession();
      return null;
    },
    [refreshSession]
  );

  const signIn = useCallback(async (): Promise<string | null> => {
    try {
      const { error } = await getAuthClient().signIn.oauth2({
        providerId: "anilist",
        callbackURL: "/",
      });
      if (error) return error.message ?? "Sign-in failed.";
    } catch {
      return "Sign-in was cancelled or could not complete.";
    }
    await refreshSession();
    return null;
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    await getAuthClient().signOut();
    setSession(null);
    setStatus("no-session");
  }, []);

  const changeServer = useCallback(async () => {
    await clearServerUrl();
    setServerUrlState(getServerUrl());
    setSession(null);
    setChangingServer(true);
    setStatus("no-server");
  }, []);

  const cancelServerChange = useCallback(async () => {
    setChangingServer(false);
    await refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthValue>(
    () => ({
      // A requested server change outranks whatever the session says, so the
      // screen stays put until it is either submitted or cancelled.
      status: changingServer && status !== "loading" ? "no-server" : status,
      serverUrl,
      session,
      setServer,
      signIn,
      signOut,
      changeServer,
      cancelServerChange,
      defaultServerUrl: getDefaultServerUrl(),
    }),
    [
      status,
      changingServer,
      serverUrl,
      session,
      setServer,
      signIn,
      signOut,
      changeServer,
      cancelServerChange,
    ]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
