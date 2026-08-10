"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiSend } from "@/lib/client/request";

type SettingsResponse = {
  notificationEmail: string | null;
  notifyNewEpisodesByEmail: boolean;
};

/**
 * AniList and MyAnimeList never hand over a real email — the account's
 * `email` column is a synthesized placeholder (see fetchAniListUser in
 * lib/auth.ts) — so an address has to be collected here before the toggle
 * below can mean anything. The switch styling matches tracker-editor.tsx's
 * "Automatic sync" toggle.
 */
export function NotificationSettings({
  initialEmail,
  initialEnabled,
  emailConfigured,
}: {
  initialEmail: string | null;
  initialEnabled: boolean;
  /** Whether this server has SMTP configured at all — see lib/email/mailer.ts. */
  emailConfigured: boolean;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [savedEmail, setSavedEmail] = useState(initialEmail);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveEmail() {
    setSavingEmail(true);
    setError(null);

    const result = await apiSend<SettingsResponse>(
      "/api/settings",
      "PATCH",
      { notificationEmail: email.trim() || null },
      { fallbackError: "Could not save the address." }
    );

    setSavingEmail(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSavedEmail(result.data.notificationEmail);
    setEnabled(result.data.notifyNewEpisodesByEmail);
  }

  async function toggle() {
    if (!savedEmail) return;

    const next = !enabled;
    setEnabled(next); // optimistic, reverted below only on failure
    setSavingToggle(true);
    setError(null);

    const result = await apiSend<SettingsResponse>(
      "/api/settings",
      "PATCH",
      { notifyNewEpisodesByEmail: next },
      { fallbackError: "Could not save." }
    );

    setSavingToggle(false);
    if (!result.ok) {
      setEnabled(!next);
      setError(result.error);
    }
  }

  const dirty = email.trim() !== (savedEmail ?? "");

  return (
    <div className="flex flex-col gap-3">
      {!emailConfigured ? (
        <p className="rounded-lg border border-border bg-surface/50 px-3 py-2 text-xs text-muted">
          This server has no SMTP configured yet — the address below saves,
          but nothing will actually send until it does.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-0 flex-1 py-2"
        />
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={saveEmail}
          disabled={savingEmail || !dirty}
        >
          {savingEmail ? "Saving…" : "Save address"}
        </Button>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={savingToggle || !savedEmail}
        title={savedEmail ? undefined : "Save an address above first"}
        className={[
          "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
          "disabled:opacity-60",
          enabled ? "border-accent bg-accent/10" : "border-border",
        ].join(" ")}
      >
        <Switch checked={enabled} />
        <span className="text-xs leading-snug">
          {savedEmail
            ? enabled
              ? `Emailing ${savedEmail} when a saved feed finds a new episode.`
              : "Off — no email is sent when new episodes show up."
            : "Save an address above to turn this on."}
        </span>
      </button>

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
