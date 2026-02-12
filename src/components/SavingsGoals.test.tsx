import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SavingsGoals } from './SavingsGoals';
import { getSavingsGoals, addSavingsGoal, updateSavingsGoal, deleteSavingsGoal } from '../db/database';

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
            expect(screen.getByText('OBIETTIVI_DI_RISPARMIO')).toBeInTheDocument();
        });

        // Check for technical labels
        expect(screen.getByText('RISPARMIATO')).toBeInTheDocument();
        expect(screen.getByText('OBIETTIVO')).toBeInTheDocument();
        
        // Check for amounts with mono font (should be present at least once)
        const amountElements = screen.getAllByText(/€500\.00/);
        expect(amountElements.length).toBeGreaterThan(0);
        expect(screen.getByText(/€1000\.00/)).toBeInTheDocument();
    });

    it('opens new goal form with structural styling', async () => {
        render(<SavingsGoals />);
        
        await waitFor(() => {
            expect(screen.getByText('OBIETTIVI_DI_RISPARMIO')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/NUOVO_ASSET/i));

        expect(screen.getByRole('heading', { name: /NUOVO_ASSET/i })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('NOME_ASSET')).toBeInTheDocument();
    });
});
