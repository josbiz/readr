"use client";

import { useEffect, useState } from "react";
import type { BookRecord } from "@/lib/db";

const PALETTES = [
  ["#3d4a3d", "#e9e4d4"],
  ["#5a3e36", "#f1e3d3"],
  ["#2f3e52", "#e4e8ee"],
  ["#4d4436", "#efe6cf"],
  ["#5b4a63", "#ece4ef"],
  ["#3b5257", "#e1ecec"],
];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The book's cover image, or a typographic cover generated from its title. */
export function Cover({ book, className = "" }: { book: BookRecord; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!book.cover) return;
    const objectUrl = URL.createObjectURL(book.cover);
    // Object URLs exist only in the browser, so they are created after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [book.cover]);

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local blob URL
      <img src={url} alt="" className={`h-full w-full object-cover ${className}`} draggable={false} />
    );
  }
  const [bg, fg] = PALETTES[hash(book.id) % PALETTES.length];
  return (
    <div
      aria-hidden="true"
      className={`flex h-full w-full flex-col justify-between p-[9%] ${className}`}
      style={{ background: bg, color: fg }}
    >
      <span className="line-clamp-5 font-serif text-[clamp(0.7rem,1.6cqi+0.5rem,1.15rem)] leading-tight font-medium">
        {book.title}
      </span>
      {book.author && <span className="line-clamp-2 text-[0.65rem] tracking-wide uppercase opacity-75">{book.author}</span>}
    </div>
  );
}
