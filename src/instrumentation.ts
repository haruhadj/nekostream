/**
 * Next calls `register` once per server instance, in every runtime, so the
 * poller is imported lazily and only under Node — it uses libSQL and timers,
 * neither of which exist on the Edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // The Docker image builds against a throwaway SQLite file; starting a poller
  // during the build would talk to that DB and reach out to AniList for nothing.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Escape hatch, mainly for `next dev` where the server restarts constantly.
  if (process.env.AIRING_POLLER === "off") return;

  const { startPoller } = await import("@/lib/airing/poller");
  startPoller();
}
