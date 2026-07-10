import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryManager } from './CategoryManager';
import * as db from '../db/database';

// Mock dependencies
vi.mock('../db/database', () => ({
    getCategories: vi.fn(),
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn()
}));

const mockCategories = [
    { id: 1, name: 'Spesa', icon: '🛒', color: '#4CAF50', isIncome: false, keywords: ['supermercato'], isDefault: true },
    { id: 2, name: 'Stipendio', icon: '💰', color: '#2196F3', isIncome: true, keywords: ['bonifico'], isDefault: true },
    { id: 3, name: 'Custom', icon: '📦', color: '#999999', isIncome: false, keywords: [], isDefault: false }
];

describe('CategoryManager Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(db.getCategories).mockResolvedValue(mockCategories);
    });

    it('renders categories with control panel styling', async () => {
        render(<CategoryManager />);
        
        await waitFor(() => {
            expect(screen.getByText('CATEGORY MANAGEMENT')).toBeInTheDocument();
        });

        expect(screen.getByText('EXPENSE CATEGORIES')).toBeInTheDocument();
        expect(screen.getByText('INCOME CATEGORIES')).toBeInTheDocument();
        
        // stylistic checks
        expect(screen.getByText('Spesa')).toBeInTheDocument();
        expect(screen.getByText('Stipendio')).toBeInTheDocument();
    });

    it('opens new category modal', async () => {
        render(<CategoryManager />);
        
        await waitFor(() => {
            expect(screen.getByText('CATEGORY MANAGEMENT')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/NEW CATEGORY/i));
        
        // Modal header should be NEW CATEGORY when adding
        expect(screen.getByRole('heading', { name: 'NEW CATEGORY' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('CATEGORY NAME')).toBeInTheDocument();
    });

    it('creates, edits, and deletes custom categories', async () => {
        render(<CategoryManager />);
        await screen.findByText('CATEGORY MANAGEMENT');

        fireEvent.click(screen.getByText(/NEW CATEGORY/i));
        fireEvent.change(screen.getByPlaceholderText('CATEGORY NAME'), { target: { value: 'Subscriptions' } });
        fireEvent.change(screen.getByPlaceholderText('E.g. BOOKSTORE, STREAMING, MARKET'), { target: { value: 'streaming, music' } });
        fireEvent.click(screen.getByText('IS INCOME CATEGORY'));
        fireEvent.click(screen.getByText('SAVE CATEGORY'));
        await waitFor(() => expect(db.addCategory).toHaveBeenCalled());

        const customRow = screen.getByText('Custom').closest('.group') as HTMLElement;
        fireEvent.click(customRow.querySelector('button[title="Edit"]') as HTMLButtonElement);
        fireEvent.change(screen.getByPlaceholderText('CATEGORY NAME'), { target: { value: 'Updated custom' } });
        fireEvent.click(screen.getByText('SAVE CATEGORY'));
        await waitFor(() => expect(db.updateCategory).toHaveBeenCalled());

        fireEvent.click(customRow.querySelector('button[title="Delete"]') as HTMLButtonElement);
        fireEvent.click(screen.getByTitle('Confirm'));
        await waitFor(() => expect(db.deleteCategory).toHaveBeenCalledWith(3));
    });
});
