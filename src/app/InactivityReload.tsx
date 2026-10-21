"use client";

import { useEffect } from "react";

const INACTIVITY_TIMEOUT_MS = 300_000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "touchstart",
  "keydown",
  "wheel",
  "scroll",
] as const;

export function InactivityReload() {
  useEffect(() => {
    let reloadTimer: number;

    const resetReloadTimer = () => {
      window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => {
        window.location.reload();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const listenerOptions = { capture: true, passive: true };

    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, resetReloadTimer, listenerOptions);
    });
    resetReloadTimer();

    return () => {
      window.clearTimeout(reloadTimer);
      ACTIVITY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, resetReloadTimer, listenerOptions);
      });
    };
  }, []);

  return null;
}
