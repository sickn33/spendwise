import { beforeEach, describe, expect, it, vi } from 'vitest';

const databaseMocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
  toArray: vi.fn(),
}));

vi.mock('../db/database', () => ({
  getCategories: databaseMocks.getCategories,
  db: {
    transactions: {
      toArray: databaseMocks.toArray,
      orderBy: vi.fn(() => ({
        reverse: vi.fn(() => ({
          limit: vi.fn(() => ({ toArray: databaseMocks.toArray })),
        })),
      })),
    },
  },
}));

import {
  buildMerchantCacheFromHistory,
  classifyTransaction,
  clearMerchantCache,
  getSuggestions,
  learnFromCorrection,
} from './classifier';

const categories = [
  { id: 1, name: 'Other expenses', icon: 'O', color: '#111', keywords: [], isDefault: true, isIncome: false },
  { id: 2, name: 'Restaurants & Cafés', icon: 'R', color: '#222', keywords: ['coffee', 'restaurant'], isDefault: true, isIncome: false },
  { id: 3, name: 'Incoming transfers', icon: 'I', color: '#333', keywords: ['salary'], isDefault: true, isIncome: true },
];

describe('classifier', () => {
  beforeEach(() => {
    clearMerchantCache();
    vi.clearAllMocks();
    databaseMocks.getCategories.mockResolvedValue(categories);
    databaseMocks.toArray.mockResolvedValue([]);
  });

  it('uses direct categories, keywords, learned merchants, and signed defaults', async () => {
    await expect(classifyTransaction('Cafe Uno', '', -10, 'Restaurants & Cafés')).resolves.toMatchObject({ categoryId: 2, method: 'bank-card' });

    clearMerchantCache();
    await expect(classifyTransaction('Coffee House', '', -4)).resolves.toMatchObject({ categoryId: 2, method: 'keyword' });

    learnFromCorrection('Custom Merchant Rome', 2);
    await expect(classifyTransaction('Custom Merchant Rome', '', -8)).resolves.toMatchObject({ categoryId: 2, method: 'merchant' });

    clearMerchantCache();
    await expect(classifyTransaction('Unknown source', '', 100)).resolves.toMatchObject({ categoryId: 3, method: 'default' });
  });

  it('builds history mappings and returns bounded unique suggestions', async () => {
    databaseMocks.toArray.mockResolvedValue([
      { description: 'Corner Coffee', categoryId: 2, date: new Date(2026, 0, 2) },
      { description: 'Corner Coffee', categoryId: 2, date: new Date(2026, 0, 1) },
      { description: 'Coffee Roaster', categoryId: 2, date: new Date(2026, 0, 3) },
    ]);

    await buildMerchantCacheFromHistory();
    await expect(classifyTransaction('Corner Coffee', '', -5)).resolves.toMatchObject({ categoryId: 2, method: 'merchant' });
    await expect(getSuggestions('co')).resolves.toEqual([
      { description: 'Corner Coffee', categoryId: 2 },
      { description: 'Coffee Roaster', categoryId: 2 },
    ]);
    await expect(getSuggestions('c')).resolves.toEqual([]);
  });
});
