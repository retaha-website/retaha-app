// Sprint Wallet · Phase 9 — HTML-Sanitization für TipTap-Output
//
// TipTap liefert HTML. Wir akzeptieren NUR eine kleine Allowlist von Tags
// und Attributen — alles andere wird gestrippt. Pattern wie DOMPurify aber
// minimal-invasive und ohne npm-Dependency (für Server-Side-Validate genug).
//
// Erlaubte Tags entsprechen genau dem was die Editor-Toolbar produziert:
//   p, br, strong, em, u, a, ul, ol, li, h2, h3, img
//
// Erlaubte Attribute:
//   a:    href (nur http/https/mailto), target=_blank
//   img:  src (nur https / Supabase Storage), alt
//
// Variable-Platzhalter {{first_name}} bleiben als reiner Text erhalten —
// renderVariables() ersetzt die beim Send.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a',
  'ul', 'ol', 'li',
  'h2', 'h3',
  'img',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a:   new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt']),
};

const ALLOWED_URL_PROTOCOLS = ['http:', 'https:', 'mailto:'];
const ALLOWED_IMG_PROTOCOLS = ['https:'];

function isAllowedUrl(url: string, protocols: string[]): boolean {
  try {
    const u = new URL(url, 'https://example.com');
    return protocols.includes(u.protocol);
  } catch {
    return false;
  }
}

/**
 * Naiver HTML-Sanitizer ohne DOM-Parser-Dependency.
 * Funktioniert via Regex-Pass — gut genug für unsere kontrollierte
 * TipTap-Output-Pipeline (kein User-supplied raw HTML).
 *
 * Strategie:
 *   1. Tag-Allowlist: <p>, <br>, <strong> etc. — alles andere gestrippt
 *   2. Attribute-Allowlist: nur href/target für <a>, src/alt für <img>
 *   3. URL-Protokoll-Check: nur http(s)/mailto
 *   4. Selbst-schließende Tags normalisieren
 */
export function sanitizeMarketingHtml(html: string): string {
  if (!html) return '';

  // Schritt 1: Tag-by-Tag durchgehen
  return html.replace(
    /<(\/?)([a-z][a-z0-9]*)\b([^>]*)>/gi,
    (full, slash, tagName, attrs) => {
      const tag = tagName.toLowerCase();

      if (!ALLOWED_TAGS.has(tag)) {
        return '';  // unbekannter Tag entfernt (Inhalt bleibt durch outer-text-Behandlung)
      }

      if (slash) {
        return `</${tag}>`;
      }

      // Selbst-schließend ohne Attribute
      if (tag === 'br') return '<br/>';

      // Attribute filtern
      const allowedAttrSet = ALLOWED_ATTRS[tag] || new Set<string>();
      const cleanedAttrs: string[] = [];

      const attrPattern = /([a-z][a-z0-9-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
      let am: RegExpExecArray | null;
      while ((am = attrPattern.exec(attrs)) !== null) {
        const name = am[1].toLowerCase();
        let value = am[2];
        // Quotes entfernen
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (!allowedAttrSet.has(name)) continue;

        // URL-Validation
        if (tag === 'a' && name === 'href') {
          if (!isAllowedUrl(value, ALLOWED_URL_PROTOCOLS)) continue;
        }
        if (tag === 'img' && name === 'src') {
          if (!isAllowedUrl(value, ALLOWED_IMG_PROTOCOLS)) continue;
        }
        if (tag === 'a' && name === 'target') {
          if (value !== '_blank') continue;
        }
        if (tag === 'a' && name === 'rel') {
          // Wir setzen rel später bei target=_blank automatisch
          continue;
        }

        // Escape Quotes im Value
        value = value.replace(/"/g, '&quot;');
        cleanedAttrs.push(`${name}="${value}"`);
      }

      // Auto-rel für <a target="_blank">
      if (tag === 'a' && cleanedAttrs.some(a => a.startsWith('target='))) {
        cleanedAttrs.push('rel="noopener noreferrer"');
      }

      const attrString = cleanedAttrs.length > 0 ? ' ' + cleanedAttrs.join(' ') : '';
      return `<${tag}${attrString}>`;
    }
  );
}
