import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be at the top level
vi.mock('@/lib/insforge', () => {
  const mockInsforge = {
    auth: {
      session: null as any,
      getCurrentUser: vi.fn(),
      getSession: vi.fn(),
      setSession: vi.fn(),
      onAuthStateChange: vi.fn(() => () => {}),
    },
    database: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => Promise.resolve({ data: [{ id: 'new-uuid' }], error: null }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => Promise.resolve({ data: [{ id: 'existing-uuid' }], error: null }))
          }))
        }))
      }))
    }
  };
  return {
    insforge: mockInsforge,
    ensureAuthHydrated: vi.fn(() => Promise.resolve()),
    getAccessToken: vi.fn(() => Promise.resolve('mock-token')),
    requireAuthenticatedInsforgeUser: vi.fn(() => Promise.resolve('test-user-uuid')),
  };
});

// Mock modules imported by manager-api
vi.mock('@/lib/insforge-crud', () => ({
  listTable: vi.fn(() => Promise.resolve([])),
  createRecord: vi.fn((table, data) => Promise.resolve({ id: 'new-record-id', ...data })),
  patchRecord: vi.fn((table, id, data) => Promise.resolve({ id, ...data })),
  deleteRecord: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/notifications-queue', () => ({
  queueNotification: vi.fn(),
}));

// Now import the module under test
import { saveOnboardingDraft } from './manager-api';
import { requireAuthenticatedInsforgeUser } from './insforge';

describe('Manager API Auth Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve user via requireAuthenticatedInsforgeUser for saveOnboardingDraft', async () => {
    const mockValues = { name: 'Test Restaurant' };
    
    await saveOnboardingDraft(null, mockValues);
    
    expect(requireAuthenticatedInsforgeUser).toHaveBeenCalled();
  });
});
