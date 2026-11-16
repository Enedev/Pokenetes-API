export const API_VERSION = '2.0.0';
export const API_V2_PREFIX = '/api/v2';
export const API_V3_VERSION = '3.0.0';
export const API_V3_PREFIX = '/api/v3';
export const API_V5_VERSION = '5.0.0';
export const API_V5_PREFIX = '/api/v5';
export const APP_VERSION = '5.0.0';
export const PUBLIC_API_PREFIX = '/api';
export type ApiContract = 'v2' | 'v3' | 'v5';
export const PUBLIC_API_VERSION: ApiContract = 'v3';

export function contractVersionOf(api: string): string {
  if (api === 'v5') return API_V5_VERSION;
  if (api === 'v3') return API_V3_VERSION;
  return API_VERSION;
}
