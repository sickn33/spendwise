import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionForm } from './TransactionForm';
import { getCategories, addTransaction } from '../db/database';
import { classifyTransaction } from '../services/classifier';

// Mock dependencies
vi.mock('../db/database', () => ({
    getCategories: vi.fn(),
    addTransaction: vi.fn(),
    updateTransaction: vi.fn(),
}));

vi.mock('../services/classifier', () => ({
    classifyTransaction: vi.fn(),
    learnFromCorrection: vi.fn(),
}));

// Mock Data
const mockCategories = [
    { id: 1, name: 'Alimentari', icon: '🛒', isIncome: false, color: '#FF5733' },
    { id: 2, name: 'Stipendio', icon: '💰', isIncome: true, color: '#33FF57' },
];

describe('TransactionForm Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCategories).mockResolvedValue(mockCategories);
        vi.mocked(classifyTransaction).mockResolvedValue({ categoryId: 1, confidence: 0.8 });
    });

    it('renders the form as a data entry sheet', async () => {
        render(<TransactionForm onClose={() => {}} onSave={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText('NEW TRANSACTION')).toBeInTheDocument();
        });

        // Check for technical labels
        expect(screen.getByText('Amount')).toBeInTheDocument();
        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('Date')).toBeInTheDocument();
        
        // Check for structural styling
        const modal = screen.getByRole('dialog');
        expect(modal.querySelector('.app-dialog-panel')).toHaveClass('structural-border');
    });

    it('handles expense/income toggle with strict style', async () => {
        render(<TransactionForm onClose={() => {}} onSave={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText('Expense')).toBeInTheDocument();
        });
        
        const incomeBtn = screen.getByText('Income');
        const expenseBtn = screen.getByText('Expense');
        
        fireEvent.click(incomeBtn);
        expect(incomeBtn).toHaveClass('bg-ink');
        expect(incomeBtn).toHaveClass('text-paper');
        expect(expenseBtn).not.toHaveClass('bg-ink');
    });

    it('submits data correctly', async () => {
        const onSave = vi.fn();
        render(<TransactionForm onClose={() => {}} onSave={onSave} />);
        
        await waitFor(() => screen.getByText('NEW TRANSACTION'));
        
        // Fill form
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50.00' } });
        fireEvent.change(screen.getByPlaceholderText('e.g. Grocery shopping'), { target: { value: 'Grocery purchase' } });
        
        // Select category
        const categoryBtn = screen.getByTitle('Select category');
        fireEvent.click(categoryBtn);
        fireEvent.click(screen.getByText('Alimentari'));
        
        // Submit
        const saveBtn = screen.getByText('SAVE');
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
                amount: -50,
                description: 'Grocery purchase',
                categoryId: 1
            }));
            expect(onSave).toHaveBeenCalled();
        });
    });

    it('rejects invalid amounts with an accessible error', async () => {
        render(<TransactionForm onClose={() => {}} onSave={() => {}} />);
        await screen.findByText('NEW TRANSACTION');

        fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'abc' } });
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Invalid row' } });
        fireEvent.submit(screen.getByText('SAVE').closest('form') as HTMLFormElement);

        expect(screen.getByRole('alert')).toHaveTextContent('greater than zero');
        expect(addTransaction).not.toHaveBeenCalled();
    });

    it('switches to a compatible income category and saves positive amounts', async () => {
        render(<TransactionForm onClose={() => {}} onSave={() => {}} />);
        await screen.findByText('NEW TRANSACTION');

        fireEvent.click(screen.getByText('Income'));
        fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1200' } });
        fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Salary' } });
        fireEvent.submit(screen.getByText('SAVE').closest('form') as HTMLFormElement);

        await waitFor(() => expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
            amount: 1200,
            categoryId: 2,
        })));
    });
});
