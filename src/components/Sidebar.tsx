import { LayoutDashboard, List, Tag, FileText, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { QuickAddWidget } from './QuickAddWidget';

export type Page = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'reports' | 'comparison' | 'settings';

interface SidebarProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
    theme: 'dark' | 'light';
    onThemeToggle: () => void;
    onTransactionAdded: () => void;
}

export function Sidebar({ currentPage, onNavigate, theme, onThemeToggle, onTransactionAdded }: SidebarProps) {
    return (
        <aside className="sidebar-v2 flex flex-col h-full overflow-hidden" role="complementary">
            {/* Top Section: Masthead + Primary Nav */}
            <div className="flex-shrink-0">
                {/* Masthead */}
                <div className="sidebar-masthead">
                    <div className="branding">
                        <div className="brand-mark"></div>
                        <div className="brand-name">SPENDWISE</div>
                    </div>
                    <div className="version-tag">
                        <span className="text-muted">v1.0.0</span>
                        <div className="version-divider"></div>
                        <span className="text-muted">STABLE</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {[
                        { id: 'dashboard', label: 'Riepilogo', icon: LayoutDashboard },
                        { id: 'transactions', label: 'Registro', icon: List },
                        { id: 'reports', label: 'Report', icon: FileText },
                        { id: 'categories', label: 'Categorie', icon: Tag },
                        { id: 'settings', label: 'Configurazione', icon: SettingsIcon },
                    ].map((item) => {
                        const isActive = currentPage === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                className={`nav-item-v2 ${isActive ? 'active' : ''}`}
                                onClick={() => onNavigate(item.id as Page)}
                            >
                                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                                <span className="nav-label">{item.label}</span>
                                {isActive && <div className="active-dot"></div>}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Middle Section: Quick Add (Scrollable) */}
            <div className="flex-1 overflow-y-auto mt-lg border-t border-border pt-md custom-scrollbar">
                <QuickAddWidget 
                    variant="sidebar" 
                    onTransactionAdded={onTransactionAdded} 
                />
            </div>

            {/* Footer / Theme Toggle */}
            <div className="sidebar-footer flex-shrink-0">
                <button 
                    onClick={onThemeToggle}
                    className="theme-toggle"
                >
                    <div className="flex items-center gap-sm">
                        {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                        <span className="font-mono text-xs text-muted">
                            {theme === 'dark' ? 'MODO SCURO' : 'MODO CHIARO'}
                        </span>
                    </div>
                    <div className={`w-2 h-2 border border-ink ${theme === 'dark' ? 'bg-ink' : 'bg-paper'}`}></div>
                </button>
            </div>
        </aside>
    );
}
