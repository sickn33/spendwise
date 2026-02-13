import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { getMonthlyStats, getCategoryBreakdown, getDailyAverageSpending } from './services/analytics';
import { getCategories, getTransactions, initializeDatabase } from './db/database';

// Mock dependencies
vi.mock('./services/analytics', () => ({
    getMonthlyStats: vi.fn(),
    getCategoryBreakdown: vi.fn(),
    getDailyAverageSpending: vi.fn().mockResolvedValue(0),
}));

vi.mock('./db/database', () => ({
    initializeDatabase: vi.fn().mockResolvedValue(undefined),
    getCategories: vi.fn().mockResolvedValue([]),
    getTransactions: vi.fn().mockResolvedValue([]),
    getQuickAddPresets: vi.fn().mockResolvedValue([]),
    initializeQuickAddPresets: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-chartjs-2', () => ({
    Doughnut: () => <div data-testid="mock-doughnut" />,
    Line: () => <div data-testid="mock-line" />,
}));

describe('Accessibility Verification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getMonthlyStats).mockResolvedValue({
            totalExpenses: 100,
            totalIncome: 200,
            transactionCount: 5,
            dailyAverage: 3.33
        } as any);
        vi.mocked(getCategoryBreakdown).mockResolvedValue([]);
    });

    it('Dashboard uses H2 for secondary headers to maintain hierarchy', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        
        await waitFor(() => {
            const h2s = document.querySelectorAll('h2');
            const h3s = document.querySelectorAll('h3');
            
            // Check major sections
            const headers = Array.from(h2s).map(h => h.textContent);
            expect(headers).toContain('DISTRIBUZIONE_CATEGORIA_v1');
            expect(headers).toContain('TREND_TEMPORALE_6M');
            
            // Should NOT have h3 (skipped levels)
            expect(h3s.length).toBe(0);
        });
    });

    it('Dashboard stat changes use text-muted instead of opacity-40 for contrast', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);
        
        await waitFor(() => {
            const statChanges = document.querySelectorAll('.stat-change');
            statChanges.forEach(el => {
                expect(el.classList.contains('opacity-40')).toBe(false);
                expect(el.classList.contains('text-muted')).toBe(true);
            });
        });
    });

    it('Settings uses H2 for section titles to maintain hierarchy', async () => {
        render(<Settings />);
        
        const h2s = document.querySelectorAll('h2');
        const h3s = document.querySelectorAll('h3');
        
        const headers = Array.from(h2s).map(h => h.textContent);
        expect(headers).toContain('IMPORTAZIONE_DATI');
        expect(headers).toContain('GMAIL_SYNCHRONIZER');
        expect(headers).toContain('DATA_EXTRACTION');
        
        // Should NOT have h3
        expect(h3s.length).toBe(0);
    });
});
