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
    { id: 2, name: 'Stipendio', icon: '💰', color: '#2196F3', isIncome: true, keywords: ['bonifico'], isDefault: true }
];

describe('CategoryManager Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(db.getCategories).mockResolvedValue(mockCategories);
    });

    it('renders categories with control panel styling', async () => {
        render(<CategoryManager />);
        
        await waitFor(() => {
            expect(screen.getByText('GESTIONE_CATEGORIE')).toBeInTheDocument();
        });

        expect(screen.getByText('CATEGORIE_SPESE')).toBeInTheDocument();
        expect(screen.getByText('CATEGORIE_ENTRATE')).toBeInTheDocument();
        
        // stylistic checks
        expect(screen.getByText('Spesa')).toBeInTheDocument();
        expect(screen.getByText('Stipendio')).toBeInTheDocument();
    });

    it('opens new category modal', async () => {
        render(<CategoryManager />);
        
        await waitFor(() => {
            expect(screen.getByText('GESTIONE_CATEGORIE')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText(/NUOVA_CATEGORIA/i));
        
        // Modal header should be NUOVA_CATEGORIA when adding
        expect(screen.getByRole('heading', { name: 'NUOVA_CATEGORIA' })).toBeInTheDocument();
        expect(screen.getByPlaceholderText('NOME_CATEGORIA')).toBeInTheDocument();
    });
});
