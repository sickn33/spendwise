import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
    initializeDatabase,
    updateSettings
} from './db/database';
import { buildMerchantCacheFromHistory } from './services/classifier';
import { useLocalBackup } from './hooks/useLocalBackup';
import { TransactionForm } from './components/TransactionForm';
import { Plus, Wallet, Keyboard } from 'lucide-react';
import './index.css';
import { Sidebar } from './components/Sidebar';
import { Dialog } from './components/Dialog';
import { usePageRoute } from './hooks/usePageRoute';
import { createBackupSnapshot } from './services/backup';

const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TransactionList = lazy(() => import('./components/TransactionList').then(m => ({ default: m.TransactionList })));
const CategoryManager = lazy(() => import('./components/CategoryManager').then(m => ({ default: m.CategoryManager })));
const BudgetManager = lazy(() => import('./components/BudgetManager').then(m => ({ default: m.BudgetManager })));
const SavingsGoals = lazy(() => import('./components/SavingsGoals').then(m => ({ default: m.SavingsGoals })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const MonthComparison = lazy(() => import('./components/MonthComparison').then(m => ({ default: m.MonthComparison })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));


function App() {
    const { currentPage, navigate: navigatePage, hrefFor } = usePageRoute();
    const [showTransactionForm, setShowTransactionForm] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [loading, setLoading] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
    const [announcement, setAnnouncement] = useState('');

    const localBackup = useLocalBackup();
    const { fileHandle, permissionStatus, saveToBackup } = localBackup;

    const initializeApp = useCallback(async () => {
        setLoading(true);
        setInitError(null);
        try {
            await initializeDatabase();
            await buildMerchantCacheFromHistory();
        } catch (error) {
            console.error('Error initializing database:', error);
            setInitError('SpendWise could not open its local database.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void initializeApp();

        // Load saved theme
        const savedTheme = localStorage.getItem('spendwise-theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
            document.documentElement.setAttribute('data-theme', savedTheme);
        } else {
            // Default to dark if no saved theme
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }, [initializeApp]);

    function handleTransactionSaved() {
        setShowTransactionForm(false);
        setRefreshTrigger(prev => prev + 1);
    }

    // Auto-backup trigger
    useEffect(() => {
        if (fileHandle && permissionStatus === 'granted') {
            const performBackup = async () => {
                try {
                    await saveToBackup(await createBackupSnapshot());
                } catch (err) {
                    console.error('Auto-backup failed:', err);
                }
            };
            performBackup();
        }
    }, [refreshTrigger, fileHandle, permissionStatus, saveToBackup]);

    function handleThemeToggle() {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('spendwise-theme', newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        void updateSettings({ theme: newTheme }).catch(error => console.error('Could not persist theme:', error));
        announce(`Theme changed to ${newTheme === 'dark' ? 'dark' : 'light'}`);
    }

    function handleBackupRestored(snapshot: Awaited<ReturnType<typeof createBackupSnapshot>>) {
        const restoredPreference = snapshot.settings?.theme;
        const restoredTheme: 'dark' | 'light' = restoredPreference === 'auto'
            ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
            : restoredPreference ?? 'dark';
        setTheme(restoredTheme);
        localStorage.setItem('spendwise-theme', restoredTheme);
        document.documentElement.setAttribute('data-theme', restoredTheme);
        setRefreshTrigger(previous => previous + 1);
        void buildMerchantCacheFromHistory();
    }

    // Screen reader announcement helper
    const announce = useCallback((message: string) => {
        setAnnouncement(message);
        setTimeout(() => setAnnouncement(''), 1000);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            // Don't trigger shortcuts when typing in inputs
            const target = e.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (document.querySelector('dialog[open]')) return;

            switch (e.key.toLowerCase()) {
                case 'n':
                    e.preventDefault();
                    setShowTransactionForm(true);
                    announce('New transaction dialog opened');
                    break;
                case 'd':
                    e.preventDefault();
                    navigatePage('dashboard');
                    announce('Dashboard');
                    break;
                case 't':
                    e.preventDefault();
                    navigatePage('transactions');
                    announce('Transactions');
                    break;
                case 'b':
                    e.preventDefault();
                    navigatePage('budgets');
                    announce('Budget');
                    break;
                case 'c':
                    e.preventDefault();
                    navigatePage('comparison');
                    announce('Monthly comparison');
                    break;
                case 'r':
                    e.preventDefault();
                    navigatePage('reports');
                    announce('Reports');
                    break;
                case 's':
                    e.preventDefault();
                    navigatePage('settings');
                    announce('Settings');
                    break;
                case '?':
                    e.preventDefault();
                    setShowShortcutsHelp(prev => !prev);
                    break;
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [announce, navigatePage]);

    if (loading) {
        return (
            <div className="loading-screen bg-paper">
                <div className="logo logo-large">
                    <div className="logo-icon">
                        <Wallet size={32} strokeWidth={2.5} />
                    </div>
                    <span>SpendWise</span>
                </div>
                <div className="spinner"></div>
                <p className="system-status">INITIALIZING_SYSTEM...</p>
            </div>
        );
    }


    if (initError) {
        return (
            <div className="loading-screen bg-paper" role="alert">
                <div className="logo logo-large"><Wallet size={32} /><span>SpendWise</span></div>
                <p>{initError}</p>
                <button className="btn btn-primary" onClick={initializeApp}>Retry initialization</button>
            </div>
        );
    }

    const pageFallback = (
        <div className="loading">
            <div className="spinner"></div>
        </div>
    );

    const renderPage = () => {
        const page = (() => {
            switch (currentPage) {
                case 'dashboard':
                    return <Dashboard onAddTransaction={() => setShowTransactionForm(true)} refreshTrigger={refreshTrigger} />;
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
                case 'comparison':
                    return <MonthComparison />;
                case 'settings':
                    return (
                        <Settings
                            onTransactionsImported={() => setRefreshTrigger(prev => prev + 1)}
                            onBackupRestored={handleBackupRestored}
                            backupController={localBackup}
                        />
                    );
                default:
                    return <Dashboard onAddTransaction={() => setShowTransactionForm(true)} refreshTrigger={refreshTrigger} />;
            }
        })();
        return <Suspense fallback={pageFallback}>{page}</Suspense>;
    };

    return (
        <div className="app">
            {/* Skip Link for keyboard navigation */}
            <a href="#main-content" className="skip-link">
                Skip to main content
            </a>

            {/* ARIA Live Region for screen reader announcements */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {announcement}
            </div>

            {/* Sidebar */}
            <Sidebar 
                currentPage={currentPage} 
                onNavigate={navigatePage}
                hrefFor={hrefFor}
                theme={theme} 
                onThemeToggle={handleThemeToggle} 
                onTransactionAdded={() => setRefreshTrigger(prev => prev + 1)}
            />

            {/* Main Content */}
            <main id="main-content" className="main-content" tabIndex={-1}>
                {renderPage()}
            </main>

            {/* FAB - Add Transaction */}
            <button
                className="fab"
                onClick={() => setShowTransactionForm(true)}
                aria-label="Add transaction"
            >
                <Plus size={24} />
            </button>


            {/* Transaction Form Modal */}
            {showTransactionForm && (
                <TransactionForm
                    onClose={() => setShowTransactionForm(false)}
                    onSave={handleTransactionSaved}
                />
            )}

            {/* Keyboard Shortcuts Help */}
            {showShortcutsHelp && (
                <Dialog titleId="shortcuts-title" onClose={() => setShowShortcutsHelp(false)} className="shortcuts-help">
                    <div className="shortcuts-help-title" id="shortcuts-title">
                        <Keyboard size={18} />
                        Keyboard shortcuts
                        <button className="btn btn-ghost btn-icon" onClick={() => setShowShortcutsHelp(false)} aria-label="Close shortcuts">×</button>
                    </div>
                    <div className="shortcuts-list">
                        <div className="shortcut-item">
                            <span>New transaction</span>
                            <span className="shortcut-key">N</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Dashboard</span>
                            <span className="shortcut-key">D</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Transactions</span>
                            <span className="shortcut-key">T</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Budget</span>
                            <span className="shortcut-key">B</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Comparison</span>
                            <span className="shortcut-key">C</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Reports</span>
                            <span className="shortcut-key">R</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Settings</span>
                            <span className="shortcut-key">S</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Close / Cancel</span>
                            <span className="shortcut-key">ESC</span>
                        </div>
                        <div className="shortcut-item">
                            <span>Show/hide help</span>
                            <span className="shortcut-key">?</span>
                        </div>
                    </div>
                </Dialog>
            )}
        </div>
    );
}

export default App;
