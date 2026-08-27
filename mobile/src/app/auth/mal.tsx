/**
 * The MyAnimeList redirect target. Exists for the same reason as
 * `anilist.tsx` — see that file for what the device showed without it.
 *
 * Linking MAL happens from Settings and leaves the app on the tabs, so "/" is
 * where this belongs too; the gate routes on from there.
 */

import { Redirect } from "expo-router";

export default function MalRedirect() {
  return <Redirect href="/" />;
}
