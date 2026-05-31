// Sprint E7 Phase 2 — Client-side Bild-Resize via Canvas
//
// Max-Breite 1200px (Hero-Cards brauchen nicht mehr → spart Bandwidth +
// Storage). Konvertiert nicht automatisch zu WebP — Quality bleibt MIME-
// abhängig (JPEG/WebP → Quality-Compression, PNG → verlustfrei).
//
// Browser-only (nutzt HTMLCanvasElement). Server-side kann diese Lib
// nicht aufrufen — wäre dann sharp.
//
// Usage im Editor (Phase 3):
//   const optimized = await resizeImage(file, 1200);
//   const form = new FormData();
//   form.append('image', optimized);

export const MAX_WIDTH = 1200;
export const JPEG_QUALITY = 0.85;

/**
 * Resized ein Image-File auf maxWidth (Aspect-Ratio bleibt) wenn größer.
 * Gibt das Original zurück wenn schon kleiner oder bei Fehler.
 */
export async function resizeImage(file: File, maxWidth = MAX_WIDTH): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    if (bitmap.width <= maxWidth) {
      bitmap.close();
      return file;
    }

    const scale = maxWidth / bitmap.width;
    const targetW = maxWidth;
    const targetH = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const outputMime = file.type === 'image/png' ? 'image/png' : file.type;
    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, outputMime, outputMime === 'image/png' ? undefined : JPEG_QUALITY)
    );
    if (!blob) return file;

    const newName = file.name.replace(/(\.[a-z]+)?$/i, (match) => match || (outputMime === 'image/png' ? '.png' : '.jpg'));
    return new File([blob], newName, { type: outputMime, lastModified: Date.now() });
  } catch (err) {
    console.warn('[client-resize] failed, using original:', err);
    return file;
  }
}
