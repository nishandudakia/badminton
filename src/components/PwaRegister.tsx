"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    navigator.serviceWorker
      .register(`${basePath}/sw.js`, { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => {
          // The browser will check again on a later visit.
        });
      })
      .catch(() => {
        // The app still works without the offline shell.
      });
  }, []);

  return null;
}
