"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Splash } from "../ui";

// pdf.js, epub.js and IndexedDB all need the browser.
const Reader = dynamic(() => import("./reader").then((m) => m.Reader), {
  ssr: false,
  loading: () => <Splash />,
});

export function ReaderLoader() {
  const bookId = useSearchParams().get("book") ?? "";
  return <Reader key={bookId} bookId={bookId} />;
}
