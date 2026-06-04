/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    /** Aktuelle Sprache aus Cookie/URL/Browser, gesetzt von src/middleware.ts */
    currentLang?: 'de' | 'en' | 'tr' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'ru' | 'ar' | 'zh';
  }
}
