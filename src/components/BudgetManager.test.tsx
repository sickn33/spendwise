import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetManager } from './BudgetManager';
import { addBudget, deleteBudget, getBudgets, getCategories, getTransactions, updateBudget } from '../db/database';

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
        expect(screen.getByText('SPENT')).toBeInTheDocument();
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
            expect(screen.getByText('NO ACTIVE BUDGET')).toBeInTheDocument();
        });
    });

    it('creates a positive budget from the empty state', async () => {
        vi.mocked(getBudgets).mockResolvedValue([]);
        render(<BudgetManager />);
        await screen.findByText('NO ACTIVE BUDGET');

        fireEvent.click(screen.getByText('START SETUP'));
        fireEvent.change(screen.getByLabelText('CATEGORY'), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText('MONTHLY BUDGET (€)'), { target: { value: '250.50' } });
        fireEvent.submit(screen.getByText('CREATE BUDGET').closest('form') as HTMLFormElement);

        await waitFor(() => expect(addBudget).toHaveBeenCalledWith({ categoryId: 1, amount: 250.5, period: 'monthly' }));
    });

    it('edits and deletes an existing budget', async () => {
        render(<BudgetManager />);
        await screen.findByText('Alimentari');

        fireEvent.click(screen.getByTitle('Edit'));
        fireEvent.change(screen.getByLabelText('MONTHLY BUDGET (€)'), { target: { value: '300' } });
        fireEvent.submit(screen.getByText('SAVE CHANGES').closest('form') as HTMLFormElement);
        await waitFor(() => expect(updateBudget).toHaveBeenCalledWith(1, { categoryId: 1, amount: 300, period: 'monthly' }));

        fireEvent.click(screen.getByTitle('Delete'));
        fireEvent.click(screen.getByRole('button', { name: 'Delete budget' }));
        await waitFor(() => expect(deleteBudget).toHaveBeenCalledWith(1));
    });
});
