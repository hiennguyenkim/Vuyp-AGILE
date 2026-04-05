/**
 * app-config.js - compatibility shim for legacy HTML includes.
 *
 * File nay van duoc nap truoc cac module script de giu co che
 * `window.__APP_ENV__`, nhung khong duoc nhung credentials o day nua.
 * Moi key/secret phai chi nam trong `.env`.
 */
(function initializeAppEnv() {
  const currentEnv =
    window.__APP_ENV__ &&
    typeof window.__APP_ENV__ === "object" &&
    !Array.isArray(window.__APP_ENV__)
      ? window.__APP_ENV__
      : {};

  window.__APP_ENV__ = { ...currentEnv };
})();
