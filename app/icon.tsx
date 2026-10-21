import { ImageResponse } from "next/og";

const ICONS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  maskable: { size: 512, maskable: true },
} as const;

type IconId = keyof typeof ICONS;

export function generateImageMetadata() {
  return (Object.keys(ICONS) as IconId[]).map((id) => ({
    id,
    contentType: "image/png",
    size: { width: ICONS[id].size, height: ICONS[id].size },
  }));
}

/** App icons, generated at build: a serif "r" on warm paper. */
export default async function Icon({ id }: { id: Promise<string> }) {
  const { size, maskable } = ICONS[(await id) as IconId] ?? ICONS["512"];
  // Maskable icons keep the glyph inside Android's 80% safe zone.
  const glyph = Math.round(size * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a2520",
          borderRadius: maskable ? 0 : size * 0.22,
          color: "#f5ecd7",
          fontSize: glyph,
          fontFamily: "Georgia, serif",
          fontStyle: "italic",
          paddingBottom: size * 0.06,
        }}
      >
        r
      </div>
    ),
    { width: size, height: size },
  );
}
