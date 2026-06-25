// Sprint Functional Modul A Phase 2 — Permissions-Layer
//
// Rollen + Permission-Map (immutable). hasPermission(role, permission) ist
// die Standard-API. requirePermission (separate Datei) kapselt die Astro-
// Endpoint-Integration.
//
// Permission-Naming-Konvention: {domain}.{action}
//   domain: hotel | team | settings | content | operations | data
//   action: read | write | invite | remove | change_role | delete | billing | export
//
// Default: owner darf alles. manager darf alles AUSSER hotel.* + team.remove
// + team.change_role + data.delete. staff darf nur operations.read/write +
// settings.read.

export type Role = 'owner' | 'manager' | 'staff';

export const ROLES: Role[] = ['owner', 'manager', 'staff'];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Inhaber',
  manager: 'Manager',
  staff: 'Front-Desk',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// readonly Tuple per Permission, damit der Type-Inferenz das Map-Lookup unterstützt
const O = ['owner'] as const;
const OM = ['owner', 'manager'] as const;
const OMS = ['owner', 'manager', 'staff'] as const;

export const PERMISSIONS = {
  // Hotel-Verwaltung (nur Owner)
  'hotel.delete':       O,
  'hotel.billing':      O,
  'hotel.security':     O,   // Team-MFA-Pflicht, Hotel-Sicherheits-Policy (Owner-only)

  // Team-Verwaltung — komplett Owner-only (Matrix: manager = „kein Team")
  'team.read':          O,
  'team.invite':        O,
  'team.remove':        O,
  'team.change_role':   O,

  // Settings
  'settings.read':      OMS,
  'settings.write':     OM,

  // Content (Eve, Picks, Action-Cards, Knowledge, Breakfast)
  'content.read':       OMS,
  'content.write':      OM,

  // Operations (Bookings, Service-Anfragen)
  'operations.read':    OMS,
  'operations.write':   OMS,  // Staff darf bestätigen — operationaler Alltag

  // Sensitive Data
  'data.export':        OM,
  'data.delete':        O,

  // Marketing-Kontaktliste / Gäste-Ansicht (Inhaber-only, v1)
  'marketing.contacts': O,
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowed = PERMISSIONS[permission] as readonly string[];
  return allowed.includes(role);
}

/** Welche Permissions hat eine Rolle? (Für UI-Toggles) */
export function permissionsForRole(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter(p =>
    (PERMISSIONS[p] as readonly string[]).includes(role)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE-ACCESS — welche App-Fläche darf eine Rolle überhaupt betreten.
//
// Das ist die GROBE Ebene (welche App), unabhängig von den feingranularen
// PERMISSIONS oben (welche Aktion innerhalb einer App). Die Matrix:
//   owner   → Backoffice + Dashboard (alles)
//   manager → Backoffice + Dashboard (Backoffice ohne Billing/Team — via PERMISSIONS)
//   staff   → nur Dashboard
//
// Diese Map ist die EINE Quelle der Wahrheit für Middleware-Surface-Gates (P2)
// und das Login-Landing-Routing (P3). Server-seitig erzwungen, nicht nur UI.
// ─────────────────────────────────────────────────────────────────────────────

export type Surface = 'backoffice' | 'dashboard';

export const SURFACES: Surface[] = ['backoffice', 'dashboard'];

const SURFACE_MATRIX: Record<Surface, readonly Role[]> = {
  backoffice: ['owner', 'manager'],
  dashboard: ['owner', 'manager', 'staff'],
};

/** Darf diese eine Rolle die Fläche betreten? Unbekannte/leere Rolle → false (fail closed). */
export function roleCanAccessSurface(role: Role | null | undefined, surface: Surface): boolean {
  if (!isRole(role)) return false;
  return (SURFACE_MATRIX[surface] as readonly string[]).includes(role);
}

/**
 * Multi-Account: ein User darf die Fläche betreten, wenn IRGENDEINE seiner
 * Rollen (über alle Hotels) sie erlaubt. Leere Liste → false (fail closed).
 */
export function anyRoleCanAccessSurface(
  roles: ReadonlyArray<Role | string | null | undefined>,
  surface: Surface,
): boolean {
  return roles.some(r => roleCanAccessSurface(r as Role, surface));
}

/**
 * Login-Landing: owner/manager → Backoffice, sonst (staff / unbekannt / leer)
 * → Dashboard. Fail closed = geringste Fläche (nie Backoffice ohne Berechtigung).
 */
export function landingSurfaceForRoles(
  roles: ReadonlyArray<Role | string | null | undefined>,
): Surface {
  return anyRoleCanAccessSurface(roles, 'backoffice') ? 'backoffice' : 'dashboard';
}
