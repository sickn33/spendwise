import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionList } from './TransactionList';
import { getTransactions, getCategories, deleteTransaction } from '../db/database';
import type { Category, Transaction } from '../types';

// Mock dependencies
vi.mock('../db/database', () => ({
    getTransactions: vi.fn(),
    getCategories: vi.fn(),
    deleteTransaction: vi.fn(),
}));

// Mock TransactionForm
vi.mock('./TransactionForm', () => ({
    TransactionForm: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="transaction-form">
            <button onClick={onClose}>Close</button>
        </div>
    )
}));

const mockTransactions = [
    { id: 1, date: '2023-05-15', amount: -50.00, categoryId: 1, description: 'Spesa Esselunga', type: 'expense' },
    { id: 2, date: '2023-05-20', amount: 1200.00, categoryId: 2, description: 'Stipendio', type: 'income' },
];

const mockCategories = [
    { id: 1, name: 'Cibo', icon: '🍔', type: 'expense' },
    { id: 2, name: 'Lavoro', icon: '💼', type: 'income' },
];

describe('TransactionList Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getTransactions).mockResolvedValue(mockTransactions as unknown as Transaction[]);
        vi.mocked(getCategories).mockResolvedValue(mockCategories as unknown as Category[]);
    });

    it('renders the technical header and load stats', async () => {
        render(<TransactionList />);
        
        expect(await screen.findByText('TRANSACTIONS LOG')).toBeInTheDocument();
        // Use regex for dynamic text
        expect(screen.getByText(/Entries loaded/)).toBeInTheDocument();
    });

    it('displays summary grid with technical labels', async () => {
        render(<TransactionList />);
        
        await waitFor(() => {
            expect(screen.getByText('TRANSACTIONS LOG')).toBeInTheDocument();
        });
        
        expect(screen.getAllByText('TOTAL EXPENSES')[0]).toBeInTheDocument();
        expect(screen.getAllByText('TOTAL INCOME')[0]).toBeInTheDocument();
        expect(screen.getAllByText('NET FLOW')[0]).toBeInTheDocument();
        
        // Verify monospace amounts
        const amounts = screen.getAllByText(/€50\.00/);
        expect(amounts.length).toBeGreaterThan(0);
        amounts.forEach(amount => expect(amount).toHaveClass('font-mono'));
    });

    it('renders the transaction ledger with correct data', async () => {
        render(<TransactionList />);
        
        await waitFor(() => {
            expect(screen.getByText('Spesa Esselunga')).toBeInTheDocument();
        });

        const row = screen.getByText('Spesa Esselunga').closest('.ledger-row');
        expect(row).toBeInTheDocument();
        
        // Check structural elements
        expect(within(row!).getByText(/CIBO/i)).toBeInTheDocument(); // Match case-insensitively
        expect(within(row!).getByText(/€50\.00/)).toHaveClass('text-danger');
    });

    it('handles delete interaction', async () => {
        render(<TransactionList />);
        
        await waitFor(() => {
            expect(screen.getByText('Stipendio')).toBeInTheDocument();
        });
        
        // Find delete button by label (first one is ID 2 because of sort desc)
        const deleteButtons = screen.getAllByRole('button', { name: "Delete" });
        fireEvent.click(deleteButtons[0]);
        
        // Wait for confirmation button to appear
        const confirmButton = await screen.findByRole('button', { name: "Confirm deletion" });
        expect(confirmButton).toBeInTheDocument();
        
        // Click confirm
        fireEvent.click(confirmButton);
        
        await waitFor(() => {
            expect(deleteTransaction).toHaveBeenCalledWith(2);
        });
    });
});
