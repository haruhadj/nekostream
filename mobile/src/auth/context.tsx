/**
 * The app-entry gate, now that there is no server to gate on.
 *
 * What this replaces: `@better-auth/expo`'s client, the better-auth session
 * cookie in SecureStore, `server-url.ts`, and the `no-server` branch that went
 * with them. The app no longer has a session in the web sense — it has tokens
 * for one or two trackers, and AniList's is the one that decides whether there
 * is anything to show.
 *
 * `loading | no-tracker | ready` is the whole state space:
 *  - `no-tracker` — no usable AniList token -> login.tsx
 *  - `ready`      — signed in -> the app
 *
 * MyAnimeList is deliberately not part of that decision. It is optional and
 * linkable later from Settings, exactly as on the web: one tracker failing
 * never blocks the other, and that rule starts here, at sign-in.
 *
 * State is held imperatively rather than in a hook bound to a client object,
 * because a token in SecureStore has no subscription to hook into — the app
 * reads it at launch and after each flow.
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

import { getAniListToken, signInWithAniList, signOutOfAniList } from "./anilist";
import { getValidMalToken, linkMyAnimeList, unlinkMyAnimeList } from "./mal";
import { readProfile, type TrackerProfile } from "./token-store";

export type AuthStatus = "loading" | "no-tracker" | "ready";

type AuthValue = {
  status: AuthStatus;
  /** Who AniList says you are. Null until signed in. */
  anilist: TrackerProfile | null;
  /** Who MAL says you are, when linked. Null is the normal, working state. */
  mal: TrackerProfile | null;
  /** Opens AniList consent. Returns an error string, or null on success. */
  signIn: () => Promise<string | null>;
  /** Opens MAL consent. Returns an error string, or null on success. */
  linkMal: () => Promise<string | null>;
  unlinkMal: () => Promise<void>;
  /** Clears AniList *and* MAL. The device keeps its library either way. */
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/**
 * What launch has to establish, in one place and with no React in it.
 *
 * MAL is read through `getValidMalToken()` rather than by asking whether a
 * profile exists, so an expired link is refreshed — or dropped, if MAL rejects
 * the refresh token — at launch, instead of failing on the first sync of the
 * session.
 */
async function loadStoredTrackers(): Promise<{
  anilist: TrackerProfile | null;
  mal: TrackerProfile | null;
  signedIn: boolean;
}> {
  const [anilistToken, malToken] = await Promise.all([
    getAniListToken(),
    getValidMalToken(),
  ]);

  const [anilist, mal] = await Promise.all([
    anilistToken ? readProfile("anilist") : null,
    malToken ? readProfile("mal") : null,
  ]);

  return { anilist, mal, signedIn: Boolean(anilistToken) };
}

export function useAuth(): AuthValue {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [anilist, setAnilist] = useState<TrackerProfile | null>(null);
  const [mal, setMal] = useState<TrackerProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadStoredTrackers();
      if (cancelled) return;
      setAnilist(stored.anilist);
      setMal(stored.mal);
      setStatus(stored.signedIn ? "ready" : "no-tracker");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (): Promise<string | null> => {
    const result = await signInWithAniList();
    if (!result.ok) {
      // A dismissed browser is the user's decision, not a failure to report.
      return result.cancelled ? null : result.error;
    }
    setAnilist(result.profile);
    setStatus("ready");
    return null;
  }, []);

  const linkMal = useCallback(async (): Promise<string | null> => {
    const result = await linkMyAnimeList();
    if (!result.ok) return result.cancelled ? null : result.error;
    setMal(result.profile);
    return null;
  }, []);

  const unlinkMal = useCallback(async () => {
    await unlinkMyAnimeList();
    setMal(null);
  }, []);

  const signOut = useCallback(async () => {
    await signOutOfAniList();
    await unlinkMyAnimeList();
    setAnilist(null);
    setMal(null);
    setStatus("no-tracker");
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ status, anilist, mal, signIn, linkMal, unlinkMal, signOut }),
    [status, anilist, mal, signIn, linkMal, unlinkMal, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
