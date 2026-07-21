"use client";

import { useCallback, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "duka-theme";

// The theme lives on <html data-theme> where the inline script in layout.tsx
// set it before paint. React reads it through useSyncExternalStore rather than
// mirroring it into state, which avoids a setState-in-effect and any hydration
// flash: the server snapshot matches the server-rendered attribute.
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function serverTheme(): Theme {
  return "light";
}

export function useTheme(): { theme: Theme; toggle: () => void; ready: boolean } {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing can block storage. The toggle still works for the session.
    }
    emit();
  }, []);

  return { theme, toggle, ready: true };
}
