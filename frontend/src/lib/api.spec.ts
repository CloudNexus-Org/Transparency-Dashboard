// AI assisted development
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('getApiBaseUrl', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns VITE_API_URL without trailing slash', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api/');
    const { getApiBaseUrl } = await import('./api');
    expect(getApiBaseUrl()).toBe('https://api.example.com/api');
  });

  it('returns /api in dev when VITE_API_URL unset', async () => {
    const { getApiBaseUrl } = await import('./api');
    expect(import.meta.env.DEV).toBe(true);
    expect(getApiBaseUrl()).toBe('/api');
  });
});
