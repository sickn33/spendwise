import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetManager } from './BudgetManager';
import { getBudgets, getCategories, getTransactions } from '../db/database';

// Mock dependencies
vi.mock('../db/database', () => ({
    getBudgets: vi.fn(),
    getCategories: vi.fn(),
    getTransactions: vi.fn(),
    addBudget: vi.fn(),
    updateBudget: vi.fn(),
    deleteBudget: vi.fn(),
}));

const mockBudgets = [
    { id: 1, categoryId: 1, amount: 200, period: 'monthly' }
];

const mockCategories = [
    { id: 1, name: 'Alimentari', icon: '🛒', isIncome: false, color: '#FF5733' },
];

const mockTransactions = [
    { id: 1, amount: -50, categoryId: 1, date: new Date(), description: 'Spesa' }
];

describe('BudgetManager Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getBudgets).mockResolvedValue(mockBudgets);
        vi.mocked(getCategories).mockResolvedValue(mockCategories);
        vi.mocked(getTransactions).mockResolvedValue(mockTransactions);
    });

    it('renders budget cards with spec sheet styling', async () => {
        render(<BudgetManager />);
        
        await waitFor(() => {
            expect(screen.getByText('Alimentari')).toBeInTheDocument();
        });

        // Check for structural border class on card
        const card = screen.getByText('Alimentari').closest('.structural-border');
        expect(card).toBeInTheDocument();
        
        // Check for technical labels
        expect(screen.getByText('SPESO')).toBeInTheDocument();
        expect(screen.getByText('BUDGET')).toBeInTheDocument();
    });

    it('displays correct progress calculation', async () => {
        render(<BudgetManager />);
        
        await waitFor(() => {
            expect(screen.getByText('€50.00')).toBeInTheDocument(); // Spent
            expect(screen.getByText('€200.00')).toBeInTheDocument(); // Budget
        });
    });

    it('shows specific empty state when no budgets', async () => {
        vi.mocked(getBudgets).mockResolvedValue([]);
        render(<BudgetManager />);
        
        await waitFor(() => {
            expect(screen.getByText('NESSUN_BUDGET_ATTIVO')).toBeInTheDocument();
        });
    });
});
