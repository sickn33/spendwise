import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const comparisonMock = vi.hoisted(() => vi.fn());

vi.mock('../services/comparison', () => ({ getMonthlyComparison: comparisonMock }));
vi.mock('react-chartjs-2', () => ({ Bar: () => <div data-testid="comparison-chart" /> }));

import { MonthComparison } from './MonthComparison';

const food = { id: 1, name: 'Food', icon: 'F', color: '#123', keywords: [], isDefault: true, isIncome: false };
const travel = { id: 2, name: 'Travel', icon: 'T', color: '#456', keywords: [], isDefault: true, isIncome: false };

const comparisonData = {
  currentMonth: { month: '2026-07', totalIncome: 2000, totalExpenses: 800, categoryBreakdown: { 1: 500, 2: 300 }, transactionCount: 8 },
  previousMonth: { month: '2026-06', totalIncome: 1800, totalExpenses: 700, categoryBreakdown: { 1: 300, 2: 400 }, transactionCount: 7 },
  deltas: {
    income: { amount: 200, percentage: 11.1, trend: 'up' as const },
    expenses: { amount: 100, percentage: 14.3, trend: 'up' as const },
    netChange: { amount: 100, percentage: 9.1, trend: 'stable' as const },
    transactionCount: { amount: 1, percentage: 14.3 },
  },
  categoryComparison: [
    {
      category: food,
      current: { amount: 500, transactionCount: 5, percentage: 62.5, averageTransaction: 100 },
      previous: { amount: 300, transactionCount: 3, percentage: 42.9, averageTransaction: 100 },
      delta: { amount: 200, percentage: 66.7, transactionCountDelta: 2 },
      trend: 'increased' as const,
      rank: { current: 1, previous: 2, change: 1 },
      insight: { it: 'More', en: 'More' },
    },
    {
      category: travel,
      current: { amount: 300, transactionCount: 3, percentage: 37.5, averageTransaction: 100 },
      previous: { amount: 400, transactionCount: 4, percentage: 57.1, averageTransaction: 100 },
      delta: { amount: -100, percentage: -25, transactionCountDelta: -1 },
      trend: 'decreased' as const,
      rank: { current: 2, previous: 1, change: -1 },
    },
  ],
  insights: [
    { type: 'warning' as const, icon: '!', title: { it: 'Warning', en: 'Warning' }, description: { it: 'Watch', en: 'Watch' }, impact: 'high' as const, value: 100 },
    { type: 'positive' as const, icon: '+', title: { it: 'Good', en: 'Good' }, description: { it: 'Saved', en: 'Saved' }, impact: 'medium' as const, value: 50 },
  ],
  metrics: {
    dailyAverageSpending: { current: 25.8, previous: 23.3, delta: 2.5 },
    biggestExpenseDay: { current: { date: new Date(2026, 6, 5), amount: 200, transactions: 2 }, previous: null },
    spendingVelocity: { currentPace: 25, previousPace: 23, projectedTotal: 900, comparedToPrevious: 28, daysRemaining: 10, daysElapsed: 21, budgetRemaining: 200, isOnTrack: true },
    weekdayAnalysis: { currentMostExpensive: 'Friday', previousMostExpensive: 'Monday' },
  },
  prediction: {
    predictedExpenses: 850,
    predictedIncome: 1900,
    confidence: 0.8,
    basedOnMonths: 6,
    categoryPredictions: [{ category: food, predictedAmount: 520, trend: 'up' as const }],
    riskFactors: [{ it: 'Rising', en: 'Rising' }],
  },
};

describe('MonthComparison', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    comparisonMock.mockResolvedValue(comparisonData);
  });

  it('renders the complete comparison and reloads when navigating months', async () => {
    render(<MonthComparison />);

    expect(await screen.findByRole('heading', { name: 'Monthly Comparison' })).toBeInTheDocument();
    expect(screen.getAllByText('Food').length).toBeGreaterThan(0);
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByTestId('comparison-chart')).toBeInTheDocument();

    const previous = screen.getByRole('button', { name: /previous month/i });
    fireEvent.click(previous);
    await waitFor(() => expect(comparisonMock).toHaveBeenCalledTimes(2));
  });

  it('shows a retryable error when comparison loading fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    comparisonMock.mockRejectedValueOnce(new Error('database unavailable'));
    render(<MonthComparison />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Comparison data could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'Monthly Comparison' })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
