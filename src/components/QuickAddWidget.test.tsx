import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QuickAddWidget } from './QuickAddWidget';
import { getQuickAddPresets, getCategories, addTransaction } from '../db/database';

// Mock dependencies
vi.mock('../db/database', () => ({
    getQuickAddPresets: vi.fn(),
    getCategories: vi.fn(),
    addTransaction: vi.fn(),
    initializeQuickAddPresets: vi.fn().mockResolvedValue(undefined),
    addQuickAddPreset: vi.fn(),
    deleteQuickAddPreset: vi.fn(),
}));

const mockPresets = [
    { id: 1, name: 'Caffè', amount: 1.5, categoryId: 1, icon: '☕' },
];

const mockCategories = [
    { id: 1, name: 'Alimentari', icon: '🛒', isIncome: false, color: '#FF5733' },
];

describe('QuickAddWidget Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getQuickAddPresets).mockResolvedValue(mockPresets);
        vi.mocked(getCategories).mockResolvedValue(mockCategories);
    });

    it('renders as a sidebar variant in closed state by default', async () => {
        render(<QuickAddWidget onTransactionAdded={() => {}} variant="sidebar" />);
        
        expect(screen.getByRole('button', { name: /quick add/i })).toBeInTheDocument();
        // Presets should NOT be visible initially in sidebar variant
        expect(screen.queryByText('Caffè')).not.toBeInTheDocument();
    });

    it('expands sidebar dropdown to show list of presets', async () => {
        render(<QuickAddWidget onTransactionAdded={() => {}} variant="sidebar" />);
        
        const header = screen.getByRole('button', { name: /quick add/i });
        fireEvent.click(header);
        
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /add caffè expense/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /create new preset/i })).toBeInTheDocument();
        });
    });

    it('handles quick add interaction in sidebar dropdown', async () => {
        const onTransactionAdded = vi.fn();
        render(<QuickAddWidget onTransactionAdded={onTransactionAdded} variant="sidebar" />);
        
        // Expand
        fireEvent.click(screen.getByRole('button', { name: /quick add/i }));
        
        // Click preset
        const preset = await screen.findByRole('button', { name: /add caffè expense/i });
        fireEvent.click(preset);
        
        await waitFor(() => {
            expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
                description: 'Caffè',
                amount: -1.5
            }));
        });
    });
});
