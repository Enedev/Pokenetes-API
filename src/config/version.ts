export const API_VERSION = '2.0.0';
export const API_V2_PREFIX = '/api/v2';
export const API_V3_VERSION = '3.0.0';
export const API_V3_PREFIX = '/api/v3';
export const APP_VERSION = '2.2.0';
export const PUBLIC_API_PREFIX = '/api';
export type ApiContract = 'v2' | 'v3';
export const PUBLIC_API_VERSION: ApiContract = 'v3';

export function contractVersionOf(api: string): string {
  return api === 'v3' ? API_V3_VERSION : API_VERSION;
}
