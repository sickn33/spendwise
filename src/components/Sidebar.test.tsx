import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar, Page } from './Sidebar';

describe('Sidebar Component', () => {
    it('renders all navigation items with Technical Editorial labels', () => {
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={() => {}} 
            />
        );

        expect(screen.getByText('RIEPILOGO')).toBeInTheDocument();
        expect(screen.getByText('REGISTRO')).toBeInTheDocument();
        expect(screen.getByText('REPORT')).toBeInTheDocument();
        expect(screen.getByText('CATEGORIE')).toBeInTheDocument();
        expect(screen.getByText('CONFIG')).toBeInTheDocument();
    });

    it('highlights the active page', () => {
        const { container } = render(
            <Sidebar 
                currentPage="transactions" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={() => {}} 
            />
        );

        const activeItem = screen.getByText('REGISTRO').closest('button');
        expect(activeItem?.classList.contains('active')).toBe(true);
        
        const inactiveItem = screen.getByText('RIEPILOGO').closest('button');
        expect(inactiveItem?.classList.contains('active')).toBe(false);
    });

    it('displays the logo and version', () => {
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={() => {}} 
            />
        );
        expect(screen.getByText('SPENDWISE')).toBeInTheDocument();
        expect(screen.getByText('v1.0.0_STABLE')).toBeInTheDocument();
    });

    it('calls onNavigate when an item is clicked', () => {
        const handleNavigate = vi.fn();
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={handleNavigate} 
                theme="dark" 
                onThemeToggle={() => {}} 
            />
        );

        fireEvent.click(screen.getByText('REGISTRO'));
        expect(handleNavigate).toHaveBeenCalledWith('transactions');
    });

    it('calls onThemeToggle when theme switch is clicked', () => {
        const handleThemeToggle = vi.fn();
        render(
            <Sidebar 
                currentPage="dashboard" 
                onNavigate={() => {}} 
                theme="dark" 
                onThemeToggle={handleThemeToggle} 
            />
        );

        fireEvent.click(screen.getByText('Tema Scuro'));
        expect(handleThemeToggle).toHaveBeenCalled();
    });
});
