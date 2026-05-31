// Sprint E7 Phase 2 — Action-Card-Image Storage-Lib
//
// Pattern aus src/pages/api/admin/upload-logo.ts:
//   - Deterministischer Pfad: {hotelId}/{cardId}.{ext}
//   - upsert: true → kein Storage-Leichen-Problem bei Bild-Ersetzung
//   - Service-Role für Storage-Write (Caller muss vorher RLS-Check
//     via getUserHotels machen!)
//   - Cache-Buster ?v={timestamp} damit der Browser das neue Bild lädt
//
// Caller-Beispiel (siehe Phase 3):
//   const user = await getUser(cookies, request);
//   const hotels = await getUserHotels(cookies, request);
//   if (!hotels.some(h => h.hotel.id === hotelId)) return 403;
//   const url = await uploadActionCardImage(hotelId, cardId, file);

import type { SupabaseClient } from '@supabase/supabase-js';

export const ACTION_CARD_BUCKET = 'action-card-images';
export const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
};

export type AllowedMime = typeof ALLOWED_MIMES[number];

export class ActionCardImageError extends Error {
  constructor(public reason: string, message: string) {
    super(message);
    this.name = 'ActionCardImageError';
  }
}

export function validateImageFile(file: File): void {
  if (file.size === 0) {
    throw new ActionCardImageError('empty', 'File is empty');
  }
  if (file.size > MAX_BYTES) {
    throw new ActionCardImageError('too_large', `File ${(file.size / 1024).toFixed(0)} KB exceeds 2 MB limit`);
  }
  if (!ALLOWED_MIMES.includes(file.type as AllowedMime)) {
    throw new ActionCardImageError('invalid_mime', `MIME ${file.type} not allowed (use JPEG/PNG/WebP)`);
  }
}

export function pathFor(hotelId: string, cardId: string, mime: string): string {
  const ext = MIME_TO_EXT[mime] ?? 'jpg';
  return `${hotelId}/${cardId}.${ext}`;
}

/**
 * Lädt ein Bild für eine Action-Card hoch und gibt die Public-URL zurück.
 * Caller MUSS vorher RLS-Check machen (hotel-membership).
 */
export async function uploadActionCardImage(
  admin: SupabaseClient,
  hotelId: string,
  cardId: string,
  file: File,
): Promise<string> {
  validateImageFile(file);

  const path = pathFor(hotelId, cardId, file.type);
  const buffer = await file.arrayBuffer();

  const { error } = await admin.storage
    .from(ACTION_CARD_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    throw new ActionCardImageError('storage_upload_failed', error.message);
  }

  const { data: pub } = admin.storage.from(ACTION_CARD_BUCKET).getPublicUrl(path);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

/**
 * Löscht alle Bilder einer Card (alle erlaubten Extensions).
 * Wird bei Card-Delete und vor MIME-Change (z.B. .png ersetzt durch .webp)
 * aufgerufen — sonst bleibt die alte Datei als Leiche im Bucket.
 */
export async function deleteActionCardImage(
  admin: SupabaseClient,
  hotelId: string,
  cardId: string,
): Promise<void> {
  const paths = Object.values(MIME_TO_EXT).map(ext => `${hotelId}/${cardId}.${ext}`);
  const { error } = await admin.storage.from(ACTION_CARD_BUCKET).remove(paths);
  if (error) {
    throw new ActionCardImageError('storage_delete_failed', error.message);
  }
}

/**
 * Extrahiert den Storage-Pfad aus einer Public-URL für Cleanup.
 * Nützlich wenn nur image_url in der DB steht und MIME unbekannt.
 */
export function pathFromPublicUrl(publicUrl: string): string | null {
  const marker = `/storage/v1/object/public/${ACTION_CARD_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx < 0) return null;
  const tail = publicUrl.slice(idx + marker.length);
  return tail.split('?')[0]; // Cache-Buster abschneiden
}
