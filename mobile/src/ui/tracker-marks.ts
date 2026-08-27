/**
 * The two trackers' official marks, ported from the web's `tracker-links.tsx`.
 * Path data from simple-icons (CC0).
 *
 * Encoded as SVG data URIs rather than drawn with `react-native-svg`, which
 * this project deliberately avoids (see the tech-stack matrix). `expo-image`
 * decodes SVG natively on both platforms — it bundles androidsvg on Android
 * and SDWebImageSVGCoder on iOS — so two brand marks cost no new native
 * module at all.
 *
 * The fill is baked into each document because these are brand marks, not
 * icons to be tinted. AniList's blue is its own; MyAnimeList's real navy
 * (#2E51A2) is unreadable on this background, so it carries the same
 * lightened #5C7EDB the web settled on.
 */

export const ANILIST_MARK =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSIjMDJBOUZGIiBkPSJNMjQgMTcuNTN2Mi40MjFjMCAuNzEtLjM5MSAxLjEwMS0xLjEgMS4xMDFoLTVsLS4wNTctLjE2NUwxMS44NCAzLjczNmMuMTA2LS41MDIuNDYtLjc4OCAxLjA1My0uNzg4aDIuNDIyYy43MSAwIDEuMS4zOTEgMS4xIDEuMXYxMi4zOEgyMi45Yy43MSAwIDEuMS4zOTIgMS4xIDEuMTAxek0xMS4wMzQgMi45NDdsNi4zMzcgMTguMTA0aC00LjkxOGwtMS4wNTItMy4xMzFINi4wMTlsLTEuMDc3IDMuMTMxSDBMNi4zNjEgMi45NDhoNC42NzN6bS0uNjYgMTAuOTYtMS42OS01LjAxNC0xLjU0MSA1LjAxNWgzLjIzeiIvPjwvc3ZnPg==";

export const MAL_MARK =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0Ij48cGF0aCBmaWxsPSIjNUM3RURCIiBkPSJNMTQuOTIxIDYuNDc5Yy0uODIgMC0zLjY4MyAwLTQuOTQ3IDMuMTU2LS42NjIgMS42NTItLjk4NiA0LjgxMi44NzYgNy44ODZsMS45MzQtMS40MXMtLjc2Ny0xLjA5NS0xLjA4My0zLjE5MWgyLjg5N2wuMDIyIDMuMTloMi42MDRWOC44MzVoLTIuNTgxdjIuMDQzbC0yLjQ2LS4wMjNzLjQxMy0yLjQwOCAyLjg3Ny0yLjMzNmgyLjQ1NGwtLjU3Mi0yLjA0Wk0wIDYuNTI4djkuNjI0aDIuMzQ4di01Ljg0bDIuMDMxIDIuNjY0IDIuMDQ3LTIuNjUydjUuODI4aDIuMzM2VjYuNTI4SDYuNDM3TDQuMzY4IDkuNDc0IDIuMzEgNi41MjhabTE4LjQ0Ny4wMjJ2OS41ODNoNS4wMjJMMjQgMTQuMDloLTMuMjMyVjYuNTVaIi8+PC9zdmc+";
