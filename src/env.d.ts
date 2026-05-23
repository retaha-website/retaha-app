/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { AdminLocale } from './i18n/types';

declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email: string;
        locale: AdminLocale;
      } | null;
      locale: AdminLocale;
    }
  }
}

export {};
