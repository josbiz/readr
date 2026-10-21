import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "readr",
    short_name: "readr",
    description: "A calm reader for your PDF and EPUB books, stored on your device.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ecebe6",
    theme_color: "#ecebe6",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
