"use client";

import { useEffect, type ReactNode } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/use-settings";

/** Keeps <html data-theme> and <html lang> in sync with settings after first paint. */
function DocumentSync() {
  const { theme } = useSettings();
  const { locale } = useI18n();

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

/**
 * Registers the service worker in production. Once it controls the page, the
 * reader code and the PDF worker are fetched when idle so they are cached for
 * offline use even if no book has been opened yet.
 */
function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    let cancelled = false;

    const warm = () => {
      if (cancelled) return;
      const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
      idle(() => {
        void import("@/components/reader/reader");
        void import("@/lib/formats/epub");
        void import("@/lib/formats/pdf").then(({ PDF_WORKER_URL }) => fetch(PDF_WORKER_URL)).catch(() => {});
      });
    };

    sw.register(`/sw.js?v=${process.env.NEXT_PUBLIC_APP_VERSION}`)
      .then(() => {
        if (sw.controller) warm();
        else sw.addEventListener("controllerchange", warm, { once: true });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
}

export function AppShell({ children }: { children: ReactNode }) {
  useServiceWorker();
  return (
    <I18nProvider>
      <DocumentSync />
      {children}
    </I18nProvider>
  );
}
