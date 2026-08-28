# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Running this app

`README.md` in this folder is the procedure for both workflows — the debug
build plus Metro for live development, and the signed release APK. Read it
before telling anyone how to run, build, or install the app, and before
touching `scripts/local-release.sh`.

Two things it will save you rediscovering: **Expo Go cannot run this project**
(the `nekostream://` OAuth redirect is registered per-provider and Expo Go does
not own that scheme), and debug and release builds carry different signatures,
so swapping between them requires an uninstall that destroys the device
database — `rss_filter` has no copy anywhere else.
