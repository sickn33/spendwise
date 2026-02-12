import { LayoutDashboard, List, Tag, FileText, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';

export type Page = 'dashboard' | 'transactions' | 'categories' | 'budgets' | 'savings' | 'reports' | 'comparison' | 'settings';

interface SidebarProps {
    currentPage: Page;
    onNavigate: (page: Page) => void;
    theme: 'dark' | 'light';
    onThemeToggle: () => void;
}

export function Sidebar({ currentPage, onNavigate, theme, onThemeToggle }: SidebarProps) {
    return (
        <aside className="sidebar structural-border bg-paper flex flex-col justify-between h-full w-[240px] fixed left-0 top-0 z-40 border-r border-border" role="complementary">
            <div>
                {/* Masthead */}
                <div className="p-md border-b border-border">
                    <div className="flex items-center gap-xs mb-xs">
                        <div className="w-3 h-3 bg-ink"></div>
                        <div className="font-display text-lg tracking-tight text-ink">SPENDWISE</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-[10px] font-mono uppercase bg-concrete px-1 py-px text-ink/70">v1.0.0</div>
                        <div className="h-px bg-border flex-1"></div>
                        <div className="text-[10px] font-mono text-ink/40">STABLE</div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col">
                    {[
                        { id: 'dashboard', label: 'RIEPILOGO', icon: LayoutDashboard },
                        { id: 'transactions', label: 'REGISTRO', icon: List },
                        { id: 'reports', label: 'REPORT', icon: FileText },
                        { id: 'categories', label: 'CATEGORIE', icon: Tag },
                        { id: 'settings', label: 'CONFIGURAZIONE', icon: SettingsIcon },
                    ].map((item) => {
                        const isActive = currentPage === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                className={`
                                    group flex items-center gap-md px-md py-4 w-full text-left transition-all duration-200 border-b border-border hover:bg-concrete
                                    ${isActive ? 'bg-concrete' : 'bg-transparent'}
                                `}
                                onClick={() => onNavigate(item.id as Page)}
                            >
                                <div className={`
                                    w-8 h-8 flex items-center justify-center border border-border transition-colors
                                    ${isActive ? 'bg-ink text-paper border-ink' : 'bg-paper text-ink group-hover:border-ink'}
                                `}>
                                    <Icon size={16} strokeWidth={1.5} />
                                </div>
                                <span className={`
                                    font-mono text-xs uppercase tracking-wider transition-colors
                                    ${isActive ? 'text-ink font-bold' : 'text-ink/70 group-hover:text-ink'}
                                `}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="ml-auto w-1.5 h-1.5 bg-ink animate-pulse"></div>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Footer / Theme Toggle */}
            <div className="p-md border-t border-border bg-paper">
                <button 
                    onClick={onThemeToggle}
                    className="w-full flex items-center justify-between group p-2 hover:bg-concrete transition-colors border border-transparent hover:border-border"
                >
                    <div className="flex items-center gap-sm">
                        <div className="w-6 h-6 flex items-center justify-center">
                            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ink/60 group-hover:text-ink">
                            {theme === 'dark' ? 'MODO SCURO' : 'MODO CHIARO'}
                        </span>
                    </div>
                    <div className={`w-2 h-2 rounded-full border border-ink ${theme === 'dark' ? 'bg-ink' : 'bg-paper'}`}></div>
                </button>
            </div>
        </aside>
    );
}
