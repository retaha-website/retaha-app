// Sprint 0+1 · Mews-Module Barrel-Exports
//
// Verwendung:  import { MewsClient, getMewsClientFromEnv, MewsApiError } from '@/lib/mews';

export { MewsClient } from './client';
export type {
  MewsCredentials,
  MewsReservationsParams,
  MewsCustomersParams,
  MewsResourcesParams,
  MewsConfigurationResponse,
  MewsReservationsResponse,
  MewsCustomersResponse,
  MewsResourcesResponse,
} from './client';
export { MewsApiError, MewsRateLimitError } from './errors';
export { getMewsClientFromEnv, getMewsClientForHotel } from './factory';
export { syncHotelFromMews, DEFAULT_RELEVANT_STATES } from './sync';
export type { SyncOptions, SyncResult } from './sync';
