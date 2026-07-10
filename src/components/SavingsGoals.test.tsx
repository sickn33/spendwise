import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SavingsGoals } from './SavingsGoals';
import { addSavingsGoal, addToSavingsGoal, deleteSavingsGoal, getSavingsGoals, updateSavingsGoal, withdrawFromSavingsGoal } from '../db/database';

// Mock dependencies
vi.mock('../db/database', () => ({
    getSavingsGoals: vi.fn(),
    addSavingsGoal: vi.fn(),
    updateSavingsGoal: vi.fn(),
    deleteSavingsGoal: vi.fn(),
    addToSavingsGoal: vi.fn(),
    withdrawFromSavingsGoal: vi.fn(),
}));

const mockGoals = [
    { id: 1, name: 'Vacanza', targetAmount: 1000, currentAmount: 500, icon: '✈️', color: '#6366f1' },
];

describe('SavingsGoals Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSavingsGoals).mockResolvedValue(mockGoals);
    });

    it('renders savings goals with asset tracker styling', async () => {
        render(<SavingsGoals />);
        
        await waitFor(() => {
            expect(screen.getByText('SAVINGS GOALS')).toBeInTheDocument();
        });

        // Check for technical labels
        expect(screen.getByText('SAVED')).toBeInTheDocument();
        expect(screen.getByText('TARGET')).toBeInTheDocument();
        
        // Check for amounts with mono font (should be present at least once)
        const amountElements = screen.getAllByText(/€500\.00/);
        expect(amountElements.length).toBeGreaterThan(0);
        expect(screen.getByText(/€1000\.00/)).toBeInTheDocument();
    });

    it('opens new goal form with structural styling', async () => {
        render(<SavingsGoals />);
        
        await waitFor(() => {
            expect(screen.getByText('SAVINGS GOALS')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/NEW GOAL/i));

        expect(screen.getByRole('heading', { name: /NEW GOAL/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('GOAL NAME')).toBeInTheDocument();
    });

    it('creates, edits, funds, withdraws, and deletes goals', async () => {
        render(<SavingsGoals />);
        await screen.findByText('SAVINGS GOALS');

        fireEvent.click(screen.getByText(/NEW GOAL/i));
        fireEvent.change(screen.getByPlaceholderText('GOAL NAME'), { target: { value: 'Emergency fund' } });
        const amounts = screen.getAllByPlaceholderText('0.00');
        fireEvent.change(amounts[0], { target: { value: '1200' } });
        fireEvent.change(amounts[1], { target: { value: '100' } });
        fireEvent.click(screen.getByText('CREATE GOAL'));
        await waitFor(() => expect(addSavingsGoal).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
        fireEvent.change(screen.getByPlaceholderText('GOAL NAME'), { target: { value: 'Updated goal' } });
        fireEvent.click(screen.getByText('Save changes'));
        await waitFor(() => expect(updateSavingsGoal).toHaveBeenCalled());

        fireEvent.click(screen.getByRole('button', { name: 'MANAGE_FUNDS' }));
        fireEvent.change(screen.getByPlaceholderText('Amount...'), { target: { value: '25' } });
        fireEvent.click(screen.getByText('ADD'));
        await waitFor(() => expect(addToSavingsGoal).toHaveBeenCalledWith(1, 25));

        fireEvent.click(screen.getByRole('button', { name: 'MANAGE_FUNDS' }));
        fireEvent.change(screen.getByPlaceholderText('Amount...'), { target: { value: '10' } });
        fireEvent.click(screen.getByText('WITHDRAW'));
        await waitFor(() => expect(withdrawFromSavingsGoal).toHaveBeenCalledWith(1, 10));

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(screen.getByRole('button', { name: 'Delete goal' }));
        await waitFor(() => expect(deleteSavingsGoal).toHaveBeenCalledWith(1));
    });
});
