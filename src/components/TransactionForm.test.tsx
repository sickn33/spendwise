import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionForm } from './TransactionForm';
import { getCategories, addTransaction, updateTransaction } from '../db/database';
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
            expect(screen.getByText('NUOVA_TRANSAZIONE')).toBeInTheDocument();
        });

        // Check for technical labels
        expect(screen.getByText('IMPORTO')).toBeInTheDocument();
        expect(screen.getByText('DESCRIZIONE')).toBeInTheDocument();
        expect(screen.getByText('DATA')).toBeInTheDocument();
        
        // Check for structural styling
        const modal = screen.getByRole('dialog');
        expect(modal).toHaveClass('structural-border');
    });

    it('handles expense/income toggle with strict style', async () => {
        render(<TransactionForm onClose={() => {}} onSave={() => {}} />);
        
        await waitFor(() => {
            expect(screen.getByText('USCITA')).toBeInTheDocument();
        });
        
        const incomeBtn = screen.getByText('ENTRATA');
        const expenseBtn = screen.getByText('USCITA');
        
        fireEvent.click(incomeBtn);
        expect(incomeBtn).toHaveClass('bg-ink');
        expect(incomeBtn).toHaveClass('text-paper');
        expect(expenseBtn).not.toHaveClass('bg-ink');
    });

    it('submits data correctly', async () => {
        const onSave = vi.fn();
        render(<TransactionForm onClose={() => {}} onSave={onSave} />);
        
        await waitFor(() => screen.getByText('NUOVA_TRANSAZIONE'));
        
        // Fill form
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '50.00' } });
        fireEvent.change(screen.getByPlaceholderText('es. Spesa Esselunga'), { target: { value: 'Spesa Esselunga' } });
        
        // Select category
        const categoryBtn = screen.getByTitle('Seleziona categoria');
        fireEvent.click(categoryBtn);
        fireEvent.click(screen.getByText('Alimentari'));
        
        // Submit
        const saveBtn = screen.getByText('SALVA_DATI');
        fireEvent.click(saveBtn);
        
        await waitFor(() => {
            expect(addTransaction).toHaveBeenCalledWith(expect.objectContaining({
                amount: -50,
                description: 'Spesa Esselunga',
                categoryId: 1
            }));
            expect(onSave).toHaveBeenCalled();
        });
    });
});
