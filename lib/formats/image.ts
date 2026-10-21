/** Draws a source onto a JPEG blob at most `width` pixels wide. */
export async function toJpeg(
  source: CanvasImageSource & { width: number; height: number },
  width = 300,
): Promise<Blob | undefined> {
  if (!source.width || !source.height) return undefined;
  const scale = Math.min(1, width / source.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? undefined), "image/jpeg", 0.85));
}

export async function downscaleImage(blob: Blob, width = 300): Promise<Blob | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      return await toJpeg(bitmap, width);
    } finally {
      bitmap.close();
    }
  } catch {
    return undefined;
  }
}
