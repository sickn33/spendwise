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

    it('renders as a utility bar', async () => {
        render(<QuickAddWidget onTransactionAdded={() => {}} />);
        
        const button = screen.getByTitle('Apertura rapida');
        expect(button).toBeInTheDocument();
        expect(button.textContent).toMatch(/AGGIUNTA RAPIDA/i);
    });

    it('expands to show grid of presets', async () => {
        render(<QuickAddWidget onTransactionAdded={() => {}} />);
        
        await waitFor(() => screen.getByTitle('Apertura rapida'));
        
        const toggleBtn = screen.getByTitle('Apertura rapida');
        fireEvent.click(toggleBtn);
        
        expect(screen.getByText('Caffè')).toBeInTheDocument();
        expect(screen.getByText('€1.50')).toBeInTheDocument();
    });

    it('handles quick add interaction', async () => {
        const onTransactionAdded = vi.fn();
        render(<QuickAddWidget onTransactionAdded={onTransactionAdded} />);
        
        await waitFor(() => screen.getByTitle('Apertura rapida'));
        
        // Expand
        fireEvent.click(screen.getByTitle('Apertura rapida'));
        
        // Click preset
        fireEvent.click(screen.getByText('Caffè'));
        
        await waitFor(() => {
            expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
                description: 'Caffè',
                amount: -1.5
            }));
        });
    });
});
