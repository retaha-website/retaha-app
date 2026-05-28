// Sprint 0+1 · Schritt 4 — Mews Connector API Client
//
// Wrapper um den POST-basierten Mews-Endpoint-Stil mit:
//   - automatischer Auth-Payload-Injection (ClientToken, AccessToken, Client)
//   - exponential backoff bei 429 (1s → 2s → 4s, max 3 retries)
//   - Network-Error-Retry (idempotent, same backoff)
//   - typisierten Error-Klassen
//   - Pagination-Support: iterateX() AsyncGenerators + getAllX() Convenience-Wrapper
//
// Endpoint-Versionen: reservations/getAll/2023-06-06 (datiert),
// customers/getAll + resources/getAll + configuration/get (versionslos).
//
// Mews-API-Konventionen (v2023-06-06):
//   - Time-Filter ist EIN Interval-Property (CollidingUtc/CreatedUtc/UpdatedUtc)
//     mit { StartUtc, EndUtc }, NICHT der alte TimeFilter-String.
//   - Limitation ist PFLICHT: { Count: 1..100, Cursor?: string }
//   - Response liefert Cursor zur Pagination, null wenn keine weiteren Seiten.

import { MewsApiError, MewsRateLimitError } from './errors';

export interface MewsCredentials {
  clientToken: string;
  accessToken: string;
  client: string;
  baseUrl: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class MewsClient {
  constructor(private readonly creds: MewsCredentials) {}

  /**
   * Internal POST helper. Injiziert Auth-Payload, retried bei 429 + Network-Errors.
   * Wirft MewsRateLimitError (nach max retries) oder MewsApiError (alle anderen Fehler).
   */
  private async post<T>(endpoint: string, payload: object = {}): Promise<T> {
    const url = `${this.creds.baseUrl}/api/connector/v1/${endpoint}`;
    const body = JSON.stringify({
      ClientToken: this.creds.clientToken,
      AccessToken: this.creds.accessToken,
      Client: this.creds.client,
      ...payload,
    });

    let lastNetworkError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      } catch (err) {
        lastNetworkError = err as Error;
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new MewsApiError(
          `Mews network-error after ${MAX_RETRIES} retries (${endpoint}): ${lastNetworkError.message}`,
        );
      }

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new MewsRateLimitError(
          `Mews rate-limit after ${MAX_RETRIES} retries (${endpoint})`,
        );
      }

      if (!response.ok) {
        let errBody: unknown;
        try {
          errBody = await response.json();
        } catch {
          try { errBody = await response.text(); } catch { errBody = null; }
        }
        throw new MewsApiError(
          `Mews API ${response.status} ${response.statusText} (${endpoint})`,
          response.status,
          errBody,
        );
      }

      return (await response.json()) as T;
    }

    throw new MewsApiError(`Unexpected fall-through in retry loop (${endpoint})`);
  }

  // ============================================================
  // Single-Page Endpoints
  // ============================================================

  /** Hotel-Konfiguration (Enterprise, Timezone, Currencies, Services). Versionslos, keine Limitation. */
  getConfiguration() {
    return this.post<MewsConfigurationResponse>('configuration/get');
  }

  /** Reservations. CollidingUtc/CreatedUtc/UpdatedUtc + Limitation pflicht. */
  getReservations(params: MewsReservationsParams) {
    return this.post<MewsReservationsResponse>('reservations/getAll/2023-06-06', params);
  }

  /** Customers. Entweder CustomerIds (Lookup) oder TimeInterval. Limitation pflicht. */
  getCustomers(params: MewsCustomersParams) {
    return this.post<MewsCustomersResponse>('customers/getAll', params);
  }

  /** Resources (= Zimmer). Limitation pflicht. */
  getResources(params: MewsResourcesParams) {
    return this.post<MewsResourcesResponse>('resources/getAll', params);
  }

  // ============================================================
  // Pagination — AsyncGenerators yield page-für-page
  // ============================================================

  async *iterateReservations(params: MewsReservationsParams): AsyncGenerator<MewsReservationsResponse> {
    let currentParams = params;
    while (true) {
      const page = await this.getReservations(currentParams);
      yield page;
      if (!page.Cursor) break;
      currentParams = {
        ...params,
        Limitation: { Count: params.Limitation.Count, Cursor: page.Cursor },
      };
    }
  }

  async *iterateCustomers(params: MewsCustomersParams): AsyncGenerator<MewsCustomersResponse> {
    let currentParams = params;
    while (true) {
      const page = await this.getCustomers(currentParams);
      yield page;
      if (!page.Cursor) break;
      currentParams = {
        ...params,
        Limitation: { Count: params.Limitation.Count, Cursor: page.Cursor },
      };
    }
  }

  async *iterateResources(params: MewsResourcesParams): AsyncGenerator<MewsResourcesResponse> {
    let currentParams = params;
    while (true) {
      const page = await this.getResources(currentParams);
      yield page;
      if (!page.Cursor) break;
      currentParams = {
        ...params,
        Limitation: { Count: params.Limitation.Count, Cursor: page.Cursor },
      };
    }
  }

  // ============================================================
  // Convenience — sammelt alle Seiten in einer Response
  // ============================================================

  async getAllReservations(params: MewsReservationsParams): Promise<MewsReservationsResponse> {
    const acc: {
      Reservations: Record<string, unknown>[];
      Customers: Record<string, unknown>[];
      Items: Record<string, unknown>[];
    } = { Reservations: [], Customers: [], Items: [] };

    for await (const page of this.iterateReservations(params)) {
      if (page.Reservations) acc.Reservations.push(...page.Reservations);
      if (page.Customers) acc.Customers.push(...page.Customers);
      if (page.Items) acc.Items.push(...page.Items);
    }
    return { ...acc, Cursor: null };
  }

  async getAllCustomers(params: MewsCustomersParams): Promise<MewsCustomersResponse> {
    const Customers: Record<string, unknown>[] = [];
    for await (const page of this.iterateCustomers(params)) {
      if (page.Customers) Customers.push(...page.Customers);
    }
    return { Customers, Cursor: null };
  }

  async getAllResources(params: MewsResourcesParams): Promise<MewsResourcesResponse> {
    const Resources: Record<string, unknown>[] = [];
    const ResourceCategories: Record<string, unknown>[] = [];
    const ResourceCategoryAssignments: Record<string, unknown>[] = [];
    for await (const page of this.iterateResources(params)) {
      if (page.Resources) Resources.push(...page.Resources);
      if (page.ResourceCategories) ResourceCategories.push(...page.ResourceCategories);
      if (page.ResourceCategoryAssignments) ResourceCategoryAssignments.push(...page.ResourceCategoryAssignments);
    }
    return { Resources, ResourceCategories, ResourceCategoryAssignments, Cursor: null };
  }
}

// ============================================================
// Param-Types (Mews v2023-06-06)
// ============================================================

export interface MewsTimeInterval {
  StartUtc: string; // ISO-8601
  EndUtc: string;
}

export interface MewsLimitation {
  Count: number;     // 1..100
  Cursor?: string;
}

/**
 * Mews Reservation-State (umbenannt in v2023-06-06: 'Enquired' → 'Inquired').
 * Quelle: Mews Connector API Migration Guide.
 */
export type MewsReservationState =
  | 'Inquired'
  | 'Confirmed'
  | 'Started'
  | 'Processed'
  | 'Canceled'
  | 'Optional';

export interface MewsReservationsParams {
  // Mindestens eines der drei Time-Intervals MUSS gesetzt sein
  CollidingUtc?: MewsTimeInterval;
  CreatedUtc?: MewsTimeInterval;
  UpdatedUtc?: MewsTimeInterval;
  States?: MewsReservationState[];
  Extent?: {
    Reservations?: boolean;
    Customers?: boolean;
    Items?: boolean;
    Services?: boolean;
    Products?: boolean;
    BusinessSegments?: boolean;
  };
  Limitation: MewsLimitation;
}

export interface MewsCustomersParams {
  // Entweder ein Time-Interval ODER explizite CustomerIds
  UpdatedUtc?: MewsTimeInterval;
  CreatedUtc?: MewsTimeInterval;
  CustomerIds?: string[];
  Extent?: { Customers?: boolean; Documents?: boolean };
  Limitation: MewsLimitation;
}

export interface MewsResourcesParams {
  ResourceIds?: string[];
  UpdatedUtc?: MewsTimeInterval;
  Extent?: {
    Resources?: boolean;
    ResourceCategories?: boolean;
    /** WICHTIG: muss true sein damit das Mapping Resource → Category mitgeliefert wird. */
    ResourceCategoryAssignments?: boolean;
    ResourceFeatures?: boolean;
    ResourceFeatureAssignments?: boolean;
    /** Mews-Filter: bei false werden inactive Resources ausgeschlossen. */
    Inactive?: boolean;
  };
  Limitation: MewsLimitation;
}

// ============================================================
// Response-Types (defensiv, only what we touch)
// ============================================================

export interface MewsConfigurationResponse {
  Enterprise?: {
    Id?: string;
    Name?: string;
    TimeZoneIdentifier?: string;
    DefaultLanguageCode?: string;
    Address?: { Line1?: string; City?: string; CountryCode?: string };
    /** Mews liefert pro Currency ein Object mit { Currency, IsDefault, IsEnabled }. */
    Currencies?: Array<{ Currency?: string; IsDefault?: boolean; IsEnabled?: boolean }>;
  };
  Services?: Array<{ Id?: string; Name?: string; Type?: string }>;
  [key: string]: unknown;
}

export interface MewsReservationsResponse {
  Reservations?: Array<Record<string, unknown>>;
  Customers?: Array<Record<string, unknown>>;
  Items?: Array<Record<string, unknown>>;
  Cursor?: string | null;
  [key: string]: unknown;
}

export interface MewsCustomersResponse {
  Customers?: Array<Record<string, unknown>>;
  Cursor?: string | null;
  [key: string]: unknown;
}

export interface MewsResourcesResponse {
  Resources?: Array<Record<string, unknown>>;
  ResourceCategories?: Array<Record<string, unknown>>;
  /** Verknüpfung Resource ↔ Category (separates Top-Level-Array in der Response). */
  ResourceCategoryAssignments?: Array<Record<string, unknown>>;
  Cursor?: string | null;
  [key: string]: unknown;
}
