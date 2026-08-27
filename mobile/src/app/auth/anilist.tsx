/**
 * The AniList redirect target, as a route.
 *
 * `WebBrowser.openAuthSessionAsync` normally swallows the `nekostream://`
 * redirect and resolves with the URL, so the router never sees it. Normally.
 * On a real device (Android 16, 2026-08-27) the redirect intent also reached
 * expo-router, which matched `auth/anilist` against the route tree, found
 * nothing, and rendered **"Unmatched Route — Page could not be found"** over a
 * sign-in that had actually succeeded.
 *
 * So the redirect URI gets a route whose only job is to get out of the way.
 * The gate in `_layout.tsx` decides where "/" actually leads — the tabs when
 * the token landed, the login screen when it didn't.
 *
 * Keep this file for as long as `ANILIST_REDIRECT_URI` points at this path.
 */

import { Redirect } from "expo-router";

export default function AniListRedirect() {
  return <Redirect href="/" />;
}
