import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from './Dashboard';
import { getMonthlyStats, getCategoryBreakdown, getDailyAverageSpending } from '../services/analytics';
import { getCategories, getTransactions } from '../db/database';
import type { MonthlyStats, Category, Transaction } from '../types';

// Mock dependencies
vi.mock('../services/analytics', () => ({
    getMonthlyStats: vi.fn(),
    getCategoryBreakdown: vi.fn(),
    getDailyAverageSpending: vi.fn(),
}));

vi.mock('../db/database', () => ({
    getCategories: vi.fn(),
    getTransactions: vi.fn(),
}));

vi.mock('react-chartjs-2', () => ({
    Doughnut: () => <div data-testid="mock-doughnut" />,
    Line: () => <div data-testid="mock-line" />,
}));

describe('Dashboard Component', () => {
    const mockMonthlyStats = {
        totalExpenses: 1250.50,
        totalIncome: 3000.00,
        transactionCount: 15,
        dailyAverage: 41.68
    };

    const mockCategoryBreakdown = [
        { label: 'CIBO', value: 450, color: '#0A1F3D' },
        { label: 'TRASPORTI', value: 120, color: '#D1D1D1' }
    ];

    const mockCategories = [
        { id: 1, name: 'CIBO', icon: '🍕', color: '#0A1F3D' },
        { id: 2, name: 'TRASPORTI', icon: '🚗', color: '#D1D1D1' }
    ];

    const mockTransactions = [
        { id: '1', description: 'Pranzo', amount: -25.50, date: new Date().toISOString(), categoryId: 1 }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getMonthlyStats).mockResolvedValue(mockMonthlyStats as unknown as MonthlyStats);
        vi.mocked(getCategoryBreakdown).mockResolvedValue(mockCategoryBreakdown as unknown as Array<{ label: string; value: number; color: string }>);
        vi.mocked(getDailyAverageSpending).mockResolvedValue(41.68);
        vi.mocked(getCategories).mockResolvedValue(mockCategories as unknown as Category[]);
        vi.mocked(getTransactions).mockResolvedValue(mockTransactions as unknown as Transaction[]);
    });

    it('renders the technical dashboard title', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        expect(await screen.findByText(/PANNELLO_CONTROLLO_v1/i)).toBeInTheDocument();
    });

    it('displays monospaced stats correctly', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        
        // Wait for stats to load
        await waitFor(() => {
            expect(screen.getByText(/€1250.50/)).toBeInTheDocument();
            expect(screen.getByText(/€3000.00/)).toBeInTheDocument();
        });

        expect(screen.getByText(/SPESE_MENSILI/)).toBeInTheDocument();
        expect(screen.getByText(/ENTRATE_MENSILI/)).toBeInTheDocument();
    });

    it('handles month navigation correctly', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        
        const prevButton = await screen.findByTitle('Mese precedente');
        fireEvent.click(prevButton);

        // Verification of reloading data for previous month
        // 8 calls per load (current, prev, and 6 for trend)
        await waitFor(() => {
            expect(getMonthlyStats).toHaveBeenCalledTimes(16);
        });
    });

    it('renders the transaction ledger', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        
        expect(await screen.findByText(/REGISTRO_TRANSAZIONI_CORRENTE/)).toBeInTheDocument();
        expect(screen.getByText('Pranzo')).toBeInTheDocument();
        // Matching across potential fragmentation and whitespace
        const amounts = screen.getAllByText(/€\s*25\.50/);
        expect(amounts.length).toBeGreaterThan(0);
    });

    it('renders category breakdown indicators in technical style', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        
        expect(await screen.findByText(/DISTRIBUZIONE_CATEGORIA_v1/)).toBeInTheDocument();
        const cats = screen.getAllByText(/CIBO/i);
        expect(cats.length).toBeGreaterThan(0);
        const totals = screen.getAllByText(/€\s*450\.00/);
        expect(totals.length).toBeGreaterThan(0);
    });
});
