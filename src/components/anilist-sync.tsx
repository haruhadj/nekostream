"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { apiSend } from "@/lib/client/request";

type SyncResponse = { added: number; skipped: number; total: number };

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "added"; count: number }
  | { kind: "failed"; message: string; needsAuth?: boolean };

/**
 * Pulls the user's AniList lists into the local library in the background.
 *
 * The library itself renders from the local database first — this never blocks
 * it, and a failure here leaves what's already on screen intact. The server
 * throttles repeat calls, so mounting this on every visit is cheap.
 */
export function AniListSync({ firstRun }: { firstRun: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State>(
    firstRun ? { kind: "running" } : { kind: "idle" }
  );
  // React runs effects twice in development; without this the import fires two
  // requests on mount.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      setState({ kind: "running" });

      const result = await apiSend<SyncResponse>(
        "/api/library/sync",
        "POST",
        undefined,
        { fallbackError: "Could not reach AniList." }
      );

      if (!result.ok) {
        setState({
          kind: "failed",
          message: result.error,
          // A 401 means the AniList token is gone or expired — no amount of
          // retrying fixes that, so point at where it can be reconnected.
          needsAuth: result.status === 401,
        });
        return;
      }

      if (result.data.added > 0) {
        setState({ kind: "added", count: result.data.added });
        router.refresh();
      } else {
        setState({ kind: "idle" });
      }
    })();
  }, [router]);

  if (state.kind === "idle") return null;

  return (
    <p
      aria-live="polite"
      className={[
        "mt-3 text-xs",
        state.kind === "failed" ? "text-rose-400" : "text-muted",
      ].join(" ")}
    >
      {state.kind === "running"
        ? "Bringing in your AniList list…"
        : state.kind === "added"
          ? `Added ${state.count} ${state.count === 1 ? "title" : "titles"} from AniList.`
          : state.message}

      {state.kind === "failed" && state.needsAuth ? (
        <>
          {" "}
          <Link href="/settings" className="underline underline-offset-2">
            Reconnect in settings
          </Link>
        </>
      ) : null}
    </p>
  );
}
