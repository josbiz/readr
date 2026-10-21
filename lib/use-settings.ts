"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_SETTINGS, getSettings, subscribeSettings, type Settings } from "./settings";

/** Current settings; re-renders on change in this tab or another. */
export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, () => DEFAULT_SETTINGS);
}
