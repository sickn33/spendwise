import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { getMonthlyStats, getCategoryBreakdown } from './services/analytics';
import type { MonthlyStats } from './types';

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
    getFileHandle: vi.fn().mockResolvedValue(null),
    saveFileHandle: vi.fn().mockResolvedValue(undefined),
    deleteFileHandle: vi.fn().mockResolvedValue(undefined),
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
        } satisfies MonthlyStats);
        vi.mocked(getCategoryBreakdown).mockResolvedValue([]);
    });

    it('text-muted utility uses theme variable (no opacity-based contrast reduction)', async () => {
        const cssPath = path.join(__dirname, 'index.css');
        const css = await readFile(cssPath, 'utf8');
        const idx = css.indexOf('.text-muted');

        expect(idx).toBeGreaterThanOrEqual(0);

        // Keep this intentionally narrow to avoid false positives on other rules.
        const ruleSnippet = css.slice(idx, idx + 220);
        expect(ruleSnippet).toMatch(/color:\s*var\(--text-muted\)/);
        expect(ruleSnippet).not.toMatch(/opacity:\s*0\.5/);
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

    it('Dashboard month navigation icon buttons have aria-label (not title-only)', async () => {
        render(<Dashboard onAddTransaction={() => {}} />);

        await waitFor(() => {
            const prev = document.querySelector('button[title="Mese precedente"]');
            const next = document.querySelector('button[title="Mese successivo"]');

            expect(prev).not.toBeNull();
            expect(next).not.toBeNull();

            expect(prev?.getAttribute('aria-label')).toBe('Mese precedente');
            expect(next?.getAttribute('aria-label')).toBe('Mese successivo');
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

        await waitFor(() => {
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
});
