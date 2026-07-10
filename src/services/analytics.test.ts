// Test suite for analytics service
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('../db/database', () => ({
  db: {
    transactions: {
      where: vi.fn().mockReturnThis(),
      between: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([])
    }
  },
  getCategories: vi.fn().mockResolvedValue([]),
  getTransactions: vi.fn().mockResolvedValue([])
}));

import {
  getMonthlyStats,
  getSpendingTrend,
  getCategoryBreakdown,
  getTopExpenses,
  getDailyAverageSpending,
  generateReportData
} from './analytics';
import { getCategories, getTransactions } from '../db/database';

describe('Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMonthlyStats', () => {
    it('should return correct stats for a month with no transactions', async () => {
      vi.mocked(getTransactions).mockResolvedValueOnce([]);

      const result = await getMonthlyStats(new Date(2026, 0, 15)); // January 2026

      expect(result).toEqual({
        month: '2026-01',
        totalIncome: 0,
        totalExpenses: 0,
        categoryBreakdown: {},
        transactionCount: 0
      });
    });

    it('should calculate income and expenses correctly', async () => {
      const mockTransactions = [
        { id: 1, amount: 1000, categoryId: 1, date: new Date(2026, 0, 10) }, // Income
        { id: 2, amount: -50, categoryId: 2, date: new Date(2026, 0, 12) },  // Expense
        { id: 3, amount: -150, categoryId: 2, date: new Date(2026, 0, 15) }, // Expense
        { id: 4, amount: 500, categoryId: 1, date: new Date(2026, 0, 20) },  // Income
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);

      const result = await getMonthlyStats(new Date(2026, 0, 15));

      expect(result.totalIncome).toBe(1500);
      expect(result.totalExpenses).toBe(200);
      expect(result.transactionCount).toBe(4);
      expect(result.categoryBreakdown).toEqual({ 2: 200 });
    });

    it('should create correct category breakdown', async () => {
      const mockTransactions = [
        { id: 1, amount: -100, categoryId: 1, date: new Date(2026, 0, 10) },
        { id: 2, amount: -50, categoryId: 2, date: new Date(2026, 0, 12) },
        { id: 3, amount: -150, categoryId: 1, date: new Date(2026, 0, 15) },
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);

      const result = await getMonthlyStats(new Date(2026, 0, 15));

      expect(result.categoryBreakdown).toEqual({
        1: 250,
        2: 50
      });
    });

    it('should format month correctly', async () => {
      vi.mocked(getTransactions).mockResolvedValueOnce([]);

      const result = await getMonthlyStats(new Date(2026, 11, 15)); // December 2026

      expect(result.month).toBe('2026-12');
    });
  });

  describe('getSpendingTrend', () => {
    it('rejects invalid month counts', async () => {
      await expect(getSpendingTrend(0)).rejects.toThrow('positive integer');
    });
    it('should return trend for specified number of months', async () => {
      vi.mocked(getTransactions).mockResolvedValue([]);

      const result = await getSpendingTrend(3);

      // Should have 3 data points
      expect(result.length).toBe(3);
      expect(result.every(r => r.value === 0)).toBe(true);
    });

    it('should return 6 months by default', async () => {
      vi.mocked(getTransactions).mockResolvedValue([]);

      const result = await getSpendingTrend();

      expect(result.length).toBe(6);
    });
  });

  describe('getCategoryBreakdown', () => {
    it('should filter only expenses when onlyExpenses is true', async () => {
      const mockTransactions = [
        { id: 1, amount: 1000, categoryId: 1, date: new Date() }, // Income - should be ignored
        { id: 2, amount: -100, categoryId: 2, date: new Date() }, // Expense
      ];

      const mockCategories = [
        { id: 1, name: 'Salary', icon: '💰', color: '#4CAF50', keywords: [], isDefault: true, isIncome: true },
        { id: 2, name: 'Food', icon: '🍕', color: '#FF5722', keywords: [], isDefault: true, isIncome: false },
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);
      vi.mocked(getCategories).mockResolvedValueOnce(mockCategories);

      const result = await getCategoryBreakdown(new Date(2026, 0, 1), new Date(2026, 0, 31), true);

      expect(result.length).toBe(1);
      expect(result[0].label).toBe('Food');
      expect(result[0].value).toBe(100);
    });

    it('should sort by value descending', async () => {
      const mockTransactions = [
        { id: 1, amount: -50, categoryId: 1, date: new Date() },
        { id: 2, amount: -200, categoryId: 2, date: new Date() },
        { id: 3, amount: -100, categoryId: 3, date: new Date() },
      ];

      const mockCategories = [
        { id: 1, name: 'Cat1', icon: '1️⃣', color: '#111', keywords: [], isDefault: true, isIncome: false },
        { id: 2, name: 'Cat2', icon: '2️⃣', color: '#222', keywords: [], isDefault: true, isIncome: false },
        { id: 3, name: 'Cat3', icon: '3️⃣', color: '#333', keywords: [], isDefault: true, isIncome: false },
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);
      vi.mocked(getCategories).mockResolvedValueOnce(mockCategories);

      const result = await getCategoryBreakdown(new Date(2026, 0, 1), new Date(2026, 0, 31));

      expect(result[0].value).toBe(200);
      expect(result[1].value).toBe(100);
      expect(result[2].value).toBe(50);
    });
  });

  describe('getTopExpenses', () => {
    it('should return only expenses (negative amounts)', async () => {
      const mockTransactions = [
        { id: 1, amount: 1000, categoryId: 1, date: new Date() },  // Income
        { id: 2, amount: -500, categoryId: 2, date: new Date() },  // Expense
        { id: 3, amount: -100, categoryId: 2, date: new Date() },  // Expense
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);

      const result = await getTopExpenses(new Date(2026, 0, 1), new Date(2026, 0, 31));

      expect(result.length).toBe(2);
      expect(result.every(t => t.amount < 0)).toBe(true);
    });

    it('should sort by amount ascending (biggest expenses first)', async () => {
      const mockTransactions = [
        { id: 1, amount: -100, categoryId: 1, date: new Date() },
        { id: 2, amount: -500, categoryId: 2, date: new Date() },
        { id: 3, amount: -250, categoryId: 3, date: new Date() },
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);

      const result = await getTopExpenses(new Date(2026, 0, 1), new Date(2026, 0, 31));

      expect(result[0].amount).toBe(-500);
      expect(result[1].amount).toBe(-250);
      expect(result[2].amount).toBe(-100);
    });

    it('should limit results to specified count', async () => {
      const mockTransactions = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        amount: -(i + 1) * 10,
        categoryId: 1,
        date: new Date()
      }));

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);

      const result = await getTopExpenses(new Date(2026, 0, 1), new Date(2026, 0, 31), 5);

      expect(result.length).toBe(5);
    });
  });

  describe('getDailyAverageSpending', () => {
    it('rejects invalid day counts', async () => {
      await expect(getDailyAverageSpending(0)).rejects.toThrow('positive integer');
    });
    it('should calculate daily average correctly', async () => {
      const mockTransactions = [
        { id: 1, amount: -300, categoryId: 1, date: new Date() },
        { id: 2, amount: -200, categoryId: 2, date: new Date() },
        { id: 3, amount: 1000, categoryId: 3, date: new Date() }, // Income - ignored
      ];

      vi.mocked(getTransactions).mockResolvedValueOnce(mockTransactions);

      const result = await getDailyAverageSpending(30);

      // Total expenses: 500, divided by 30 days = 16.67
      expect(result).toBeCloseTo(16.67, 1);
    });

    it('should return 0 when no expenses', async () => {
      vi.mocked(getTransactions).mockResolvedValueOnce([]);

      const result = await getDailyAverageSpending(30);

      expect(result).toBe(0);
    });
  });

  describe('generateReportData', () => {
    it('keeps income out of expense category percentages', async () => {
      vi.mocked(getTransactions).mockResolvedValueOnce([
        { id: 1, amount: 1000, categoryId: 1, date: new Date() },
        { id: 2, amount: -100, categoryId: 2, date: new Date() },
      ]);
      vi.mocked(getCategories).mockResolvedValueOnce([
        { id: 1, name: 'Income', icon: 'I', color: '#0a0', keywords: [], isDefault: true, isIncome: true },
        { id: 2, name: 'Food', icon: 'F', color: '#a00', keywords: [], isDefault: true, isIncome: false },
      ]);
      vi.mocked(getTransactions).mockResolvedValue([]);

      const report = await generateReportData(new Date(2026, 0, 1), new Date(2026, 0, 31));

      expect(report.totalIncome).toBe(1000);
      expect(report.totalExpenses).toBe(100);
      expect(report.categoryBreakdown).toHaveLength(1);
      expect(report.categoryBreakdown[0]).toMatchObject({ amount: 100, percentage: 100, transactionCount: 1 });
    });
  });
});
