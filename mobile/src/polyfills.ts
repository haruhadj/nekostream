/**
 * Imported first, before anything else in the app.
 *
 * `AbortSignal.timeout()` does not exist under React Native. RN installs
 * `abort-controller@3` as its AbortController/AbortSignal (see
 * `react-native/Libraries/Core/setUpXHR.js`), and that package predates the
 * static — it ships `AbortSignal.prototype` methods and nothing else.
 *
 * This matters more than it looks: **all three** of the shared clients this
 * app now depends on call it — `@shared/anilist/client`, `@shared/mal/client`
 * and `@shared/nyaa/rss` all pass `signal: AbortSignal.timeout(timeoutMs)`.
 * Without this shim every one of them throws `AbortSignal.timeout is not a
 * function` on the first request, on the device only.
 *
 * A shim here rather than a fork of those modules: the whole premise of the
 * standalone plan is that the domain layer is shared with the server, not
 * copied. Where the runtimes differ, the runtime is what gets patched.
 *
 * The polyfilled signal aborts with no reason, because RN's `abort()` predates
 * that argument too. Callers only distinguish "the fetch failed" from "it
 * didn't", so nothing reads the reason.
 */

type TimeoutCapable = { timeout?: (ms: number) => AbortSignal };

const AbortSignalCtor = AbortSignal as unknown as TimeoutCapable;

if (typeof AbortSignalCtor.timeout !== "function") {
  AbortSignalCtor.timeout = (ms: number): AbortSignal => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

export {};
