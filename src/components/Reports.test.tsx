import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reports } from './Reports';
import { getTransactions, getCategories } from '../db/database';

// Mock dependencies
vi.mock('../db/database', () => ({
    getTransactions: vi.fn(),
    getCategories: vi.fn(),
}));

// Mock Chart.js to avoid canvas errors in JSDOM
vi.mock('react-chartjs-2', () => ({
    Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
    Doughnut: () => <div data-testid="doughnut-chart">Doughnut Chart</div>,
    Line: () => <div data-testid="line-chart">Line Chart</div>,
}));

const mockTransactions = [
    { id: 1, amount: -50, categoryId: 1, date: new Date(), description: 'Spesa' }
];

const mockCategories = [
    { id: 1, name: 'Alimentari', icon: '🛒', isIncome: false, color: '#FF5733' },
];

describe('Reports Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getTransactions).mockResolvedValue(mockTransactions);
        vi.mocked(getCategories).mockResolvedValue(mockCategories);
    });

    it('renders reports with structural layout', async () => {
        render(<Reports />);
        
        await waitFor(() => {
            expect(screen.getByText('REPORT_MENSILE')).toBeInTheDocument();
        });

        // Check for structural grid layout
        expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
        // Check for new technical labels
        expect(screen.getByText('SPESE_PER_CATEGORIA')).toBeInTheDocument();
    });

    it('renders date filters with utility style', async () => {
        render(<Reports />);
        
        await waitFor(() => {
            expect(screen.getByText('REPORT_MENSILE')).toBeInTheDocument();
            // Check for select element
            expect(screen.getByRole('combobox')).toBeInTheDocument();
            expect(screen.getByText('MESE_CORRENTE')).toBeInTheDocument();
        });
    });
});
