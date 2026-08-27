/**
 * The web app's design tokens (src/app/globals.css), ported flat — no
 * light/dark switching, since the app is dark-only. Plain values, not a
 * Tailwind runtime: this file is imported directly by StyleSheet.create()
 * calls.
 */

export const theme = {
  color: {
    background: "#09090b",
    surface: "#18181b",
    border: "#27272a",
    muted: "#a1a1aa",
    foreground: "#fafafa",

    // Primary interactive color. Not a brand mark — see anilist/mal below.
    accent: "#6366f1",
    accentHover: "#818cf8",
    accentForeground: "#ffffff",

    // Provider brand marks only: OAuth buttons, tracker chips, the tracker
    // dialog's provider dot. Nothing decorative reaches for these.
    anilist: "#02a9ff",
    // MAL's real navy (#2e51a2) is unreadable on the dark background —
    // lightened for on-dark use, matching tracker-links.tsx on the web.
    mal: "#5c7edb",

    // "Aired but not watched" — the schedule's whole signal. The web says
    // this with amber-400/amber-300 (schedule-list.tsx); these are those two,
    // resolved, plus a pre-blended 50% fill because React Native has no
    // stacking-context alpha shorthand.
    amber: "#fbbf24",
    amberText: "#fcd34d",
    amberFill: "#7d6014",
    amberBorder: "#4a3d1c",

    danger: "#f87171",
  },
} as const;
