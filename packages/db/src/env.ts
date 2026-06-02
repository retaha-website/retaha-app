/**
 * Kontext-robuster Env-Reader.
 *
 * - Astro/Vite-Server-Runtime: `import.meta.env` (Vite injected diese sowohl
 *   zur Build- als auch zur Runtime — PUBLIC_*-Vars als String-Literale, andere
 *   Server-only zur Runtime).
 * - Node/tsx-Standalone-Scripts (kein Vite-Wrapper): `process.env`, befüllt
 *   via `node --env-file=.env` / `tsx --env-file=.env`.
 *
 * Returnt `undefined` wenn der Key in keinem Kontext gesetzt ist (oder leer).
 */
export function getEnv(key: string): string | undefined {
  // Astro/Vite-Kontext
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const v = (import.meta as any).env[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  // Node/tsx-Kontext
  if (typeof process !== 'undefined' && process.env) {
    const v = process.env[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}
