/** Sanitized tel:-Href für Hotel-Telefonnummer. Entfernt alles außer + und Ziffern. */
export const telHref = (raw?: string | null): string | null =>
  raw ? 'tel:' + raw.replace(/[^+\d]/g, '') : null;
