import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getMonthlyStats: vi.fn(),
  getCategories: vi.fn(),
  getSettings: vi.fn(),
  toArray: vi.fn(),
}));

vi.mock('../db/database', () => ({
  getCategories: mocks.getCategories,
  getSettings: mocks.getSettings,
  db: {
    transactions: {
      where: vi.fn(() => ({
        between: vi.fn(() => ({ toArray: mocks.toArray })),
      })),
    },
  },
}));

vi.mock('./analytics', () => ({ getMonthlyStats: mocks.getMonthlyStats }));

import { generateMonthlyInsights, generatePrediction, getMonthlyComparison } from './comparison';

const category = { id: 1, name: 'Food', icon: 'F', color: '#123', keywords: [], isDefault: true, isIncome: false };

describe('comparison analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCategories.mockResolvedValue([category]);
    mocks.getSettings.mockResolvedValue({ monthlyBudget: 1000 });
    mocks.toArray.mockResolvedValue([]);
    mocks.getMonthlyStats.mockImplementation(async (date: Date) => {
      const current = date.getFullYear() === 2026 && date.getMonth() === 0;
      const expenses = current ? 300 : 200;
      return {
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        totalIncome: current ? 1000 : 900,
        totalExpenses: expenses,
        categoryBreakdown: { 1: expenses },
        transactionCount: current ? 3 : 2,
      };
    });
  });

  it('assembles deltas, category comparisons, metrics, insights, and finite predictions', async () => {
    const result = await getMonthlyComparison(new Date(2026, 0, 15));

    expect(result.deltas.expenses.amount).toBe(100);
    expect(result.categoryComparison[0].category.name).toBe('Food');
    expect(result.categoryComparison[0].trend).toBe('increased');
    expect(result.metrics.spendingVelocity.projectedTotal).toBe(0);
    expect(Number.isFinite(result.prediction?.predictedExpenses)).toBe(true);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it('covers positive, warning, new-category, and velocity insight branches', async () => {
    const base = { month: '2026-01', totalIncome: 1000, totalExpenses: 100, categoryBreakdown: { 1: 100 }, transactionCount: 2 };
    const previous = { ...base, month: '2025-12', totalExpenses: 250 };
    const categoryComparison = [{
      category,
      current: { amount: 100, transactionCount: 2, percentage: 100, averageTransaction: 50 },
      previous: { amount: 250, transactionCount: 3, percentage: 100, averageTransaction: 83.33 },
      delta: { amount: -150, percentage: -60, transactionCountDelta: -1 },
      trend: 'decreased' as const,
      rank: { current: 1, previous: 1, change: 0 },
    }];

    const insights = await generateMonthlyInsights(base, previous, categoryComparison, {
      currentPace: 5,
      previousPace: 8,
      projectedTotal: 150,
      comparedToPrevious: -40,
      daysRemaining: 10,
      daysElapsed: 20,
      isOnTrack: true,
    });

    expect(insights.map(item => item.type)).toContain('achievement');
    expect(insights.map(item => item.type)).toContain('positive');
    expect(insights.map(item => item.type)).toContain('neutral');
  });

  it('rejects an invalid prediction window', async () => {
    await expect(generatePrediction(0)).rejects.toThrow('positive integer');
  });
});
