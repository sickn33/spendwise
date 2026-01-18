import { useState, useEffect } from 'react';
import { initializeDatabase } from './db/database';
import { buildMerchantCacheFromHistory } from './services/classifier';
import { Dashboard } from './components/Dashboard';
import { TransactionList } from './components/TransactionList';
import { TransactionForm } from './components/TransactionForm';
import { CategoryManager } from './components/CategoryManager';
import { BudgetManager } from './components/BudgetManager';
import { SavingsGoals } from './components/SavingsGoals';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { QuickAddWidget } from './components/QuickAddWidget';
import { LayoutDashboard, List, Tag, FileText, Settings as SettingsIcon, Plus, Wallet, PiggyBank, Target, Sun, Moon } from 'lucide-react';
import './index.css';

type Page = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'reports' | 'settings';

function App() {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        async function init() {
            try {
                await initializeDatabase();
                await buildMerchantCacheFromHistory();
            } catch (error) {
                console.error('Error initializing database:', error);
            } finally {
                setLoading(false);
            }
        }
        init();

        // Load saved theme
        const savedTheme = localStorage.getItem('spendwise-theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        }
    }, []);

    function handleTransactionSaved() {
        setShowTransactionForm(false);
        setRefreshTrigger(prev => prev + 1);
    }

    function handleThemeToggle() {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('spendwise-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    }

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                flexDirection: 'column',
                gap: 'var(--space-lg)'
            }}>
                <div className="logo">
                    <div className="logo-icon">
                        <Wallet size={24} />
                    </div>
                    <span>SpendWise</span>
                </div>
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-muted)' }}>Caricamento...</p>
            </div>
        );
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard':
                return <Dashboard onAddTransaction={() => setShowTransactionForm(true)} />;
            case 'transactions':
                return <TransactionList refreshTrigger={refreshTrigger} />;
            case 'categories':
                return <CategoryManager />;
            case 'budgets':
                return <BudgetManager />;
            case 'savings':
                return <SavingsGoals />;
            case 'reports':
                return <Reports />;
            case 'settings':
                return <Settings />;
            default:
                return <Dashboard onAddTransaction={() => setShowTransactionForm(true)} />;
        }
    };

    return (
        <div className="app">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="logo">
                    <div className="logo-icon">
                        <Wallet size={20} />
                    </div>
                    <span>SpendWise</span>
                </div>

                <nav className="nav">
                    <button
                        className={`nav-item ${currentPage === 'dashboard' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('dashboard')}
                    >
                        <LayoutDashboard size={20} />
                        <span>Dashboard</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'transactions' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('transactions')}
                    >
                        <List size={20} />
                        <span>Transazioni</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'budgets' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('budgets')}
                    >
                        <PiggyBank size={20} />
                        <span>Budget</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'categories' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('categories')}
                    >
                        <Tag size={20} />
                        <span>Categorie</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'savings' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('savings')}
                    >
                        <Target size={20} />
                        <span>Risparmi</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'reports' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('reports')}
                    >
                        <FileText size={20} />
                        <span>Report</span>
                    </button>

                    <button
                        className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
                        onClick={() => setCurrentPage('settings')}
                    >
                        <SettingsIcon size={20} />
                        <span>Impostazioni</span>
                    </button>
                </nav>

                {/* Theme Toggle in Sidebar */}
                <div
                    className="theme-toggle"
                    onClick={handleThemeToggle}
                    style={{ cursor: 'pointer', marginTop: 'auto' }}
                >
                    <div className={`theme-toggle-switch ${theme === 'light' ? 'active' : ''}`}>
                        <div className="theme-toggle-knob">
                            {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                        </div>
                    </div>
                    <span className="theme-toggle-label">
                        {theme === 'dark' ? 'Tema Scuro' : 'Tema Chiaro'}
                    </span>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {renderPage()}
            </main>

            {/* FAB - Add Transaction */}
            <button
                className="fab"
                onClick={() => setShowTransactionForm(true)}
                aria-label="Aggiungi transazione"
            >
                <Plus size={24} />
            </button>

            {/* Quick Add Widget */}
            <QuickAddWidget onTransactionAdded={() => setRefreshTrigger(prev => prev + 1)} />

            {/* Transaction Form Modal */}
            {showTransactionForm && (
                <TransactionForm
                    onClose={() => setShowTransactionForm(false)}
                    onSave={handleTransactionSaved}
                />
            )}
        </div>
    );
}

export default App;
