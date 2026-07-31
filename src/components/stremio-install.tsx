"use client";

import { useEffect, useState } from "react";

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "failed"; message: string };

/**
 * Shows the addon URL to paste into Stremio.
 *
 * The token in that URL is the only thing standing between the internet and
 * this user's library, so it is fetched on demand rather than rendered into the
 * page server-side, and rotating it is offered right here.
 */
export function StremioInstall() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/library/stremio-token");
        const json = await res.json();
        if (!res.ok) {
          setState({
            kind: "failed",
            message: json.error ?? "Could not load the addon URL.",
          });
          return;
        }
        setState({ kind: "ready", url: json.url });
      } catch {
        setState({ kind: "failed", message: "Could not reach the server." });
      }
    })();
  }, []);

  async function rotate() {
    if (
      !confirm("Rotate the token? Stremio will need the new URL reinstalled.")
    )
      return;

    setRotating(true);
    try {
      const res = await fetch("/api/library/stremio-token/rotate", {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) setState({ kind: "ready", url: json.url });
    } finally {
      setRotating(false);
    }
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (state.kind === "loading") {
    return <p className="mt-5 text-xs text-muted">Loading addon URL…</p>;
  }

  if (state.kind === "failed") {
    return <p className="mt-5 text-xs text-rose-400">{state.message}</p>;
  }

  return (
    <div className="mt-5">
      <code className="block overflow-x-auto rounded-xl border border-edge bg-surface/60 px-4 py-3 font-mono text-xs text-muted">
        {state.url}
      </code>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => copy(state.url)}
          className="rounded-xl border border-edge bg-surface/60 px-4 py-2.5 text-sm font-semibold transition hover:border-anilist/60"
        >
          {copied ? "Copied" : "Copy URL"}
        </button>

        {/* Stremio registers the stremio:// scheme — same URL, one click. */}
        <a
          href={state.url.replace(/^https?:\/\//, "stremio://")}
          className="rounded-xl border border-edge bg-surface/60 px-4 py-2.5 text-sm font-semibold transition hover:border-anilist/60"
        >
          Install in Stremio
        </a>

        <button
          type="button"
          onClick={rotate}
          disabled={rotating}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-rose-400 disabled:opacity-50"
        >
          {rotating ? "Rotating…" : "Rotate token"}
        </button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">
        Anyone with this URL can read your library, so keep it private. Stremio
        Desktop and Android accept a plain http:// address on your own network;
        Stremio Web needs the server reachable over https.
      </p>
    </div>
  );
}
