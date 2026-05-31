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
  staff: 'Mitarbeiter',
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

  // Team-Verwaltung
  'team.read':          OMS,
  'team.invite':        OM,
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
