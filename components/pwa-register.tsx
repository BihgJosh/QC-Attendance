"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA support.
 * Members can add the app to their home screen.
 *
 * When a new service worker takes control (e.g. after a deploy), the page
 * reloads once so the user immediately gets the latest version instead of a
 * stale cached page.
 */
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((registration) => registration.update()).catch(() => {
      // Registration failed — likely offline or unsupported.
      // The app still works, just without offline caching.
    });

    // When the controlling service worker changes, reload once to pick up
    // the new assets. The guard prevents an infinite reload loop.
    let reloaded = false;
    const onControllerChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
