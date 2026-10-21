"use client";

import dynamic from "next/dynamic";
import { Splash } from "../ui";

// The library reads IndexedDB, so it only renders in the browser.
export const LibraryLoader = dynamic(() => import("./library").then((m) => m.Library), {
  ssr: false,
  loading: () => <Splash />,
});
