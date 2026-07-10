import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { getQuickAddPresets, addTransaction, getCategories, addQuickAddPreset, deleteQuickAddPreset, initializeQuickAddPresets } from '../db/database';
import type { QuickAddPreset, Category } from '../types';
import { Plus, X, Settings, Check, Trash2, ArrowRight, ChevronRight } from 'lucide-react';
import { Dialog } from './Dialog';
import { ConfirmDialog } from './ConfirmDialog';

interface QuickAddWidgetProps {
    onTransactionAdded: () => void;
    variant?: 'floating' | 'sidebar';
}

export const QuickAddWidget = memo(function QuickAddWidget({ onTransactionAdded, variant = 'floating' }: QuickAddWidgetProps) {
    const [presets, setPresets] = useState<QuickAddPreset[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isExpanded, setIsExpanded] = useState(false); // Used for FAB in floating variant
    const [isOpen, setIsOpen] = useState(false); // Used for Dropdown in sidebar variant
    const [isEditing, setIsEditing] = useState(false);
    const [addingSuccess, setAddingSuccess] = useState<number | null>(null);
    const [addingPresetId, setAddingPresetId] = useState<number | null>(null);
    const [showAddNew, setShowAddNew] = useState(false);
    const [deletePresetId, setDeletePresetId] = useState<number | null>(null);
    const [deletingPreset, setDeletingPreset] = useState(false);
    const [newPreset, setNewPreset] = useState({ name: '', amount: '', categoryId: 0, icon: '💰' });
    const successTimerRef = useRef<number | null>(null);
    const mountedRef = useRef(true);

    const loadData = useCallback(async () => {
        await initializeQuickAddPresets();
        const [p, c] = await Promise.all([
            getQuickAddPresets(),
            getCategories()
        ]);
        if (!mountedRef.current) return;
        setPresets(p);
        setCategories(c);
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        void Promise.resolve().then(loadData);
        return () => {
            mountedRef.current = false;
            if (successTimerRef.current !== null) {
                window.clearTimeout(successTimerRef.current);
            }
        };
    }, [loadData]);

    async function handleQuickAdd(preset: QuickAddPreset) {
        if (isEditing || addingPresetId !== null) return;

        try {
            setAddingPresetId(preset.id!);
            await addTransaction({
                date: new Date(),
                description: preset.name,
                details: 'Quick add',
                amount: -preset.amount,
                currency: 'EUR',
                categoryId: preset.categoryId,
                isRecurring: false,
                tags: ['quick-add'],
                account: '',
                isContabilized: true
            });

            setAddingSuccess(preset.id!);
            onTransactionAdded();
            if (successTimerRef.current !== null) {
                window.clearTimeout(successTimerRef.current);
            }
            successTimerRef.current = window.setTimeout(() => {
                setAddingSuccess(null);
                successTimerRef.current = null;
            }, 1000);
        } catch (error) {
            console.error('Error adding transaction:', error);
        } finally {
            if (mountedRef.current) setAddingPresetId(null);
        }
    }

    async function handleAddNewPreset() {
        const amount = Number(newPreset.amount.replace(',', '.'));
        if (!newPreset.name.trim() || !Number.isFinite(amount) || amount <= 0 || !newPreset.categoryId) return;

        await addQuickAddPreset({
            name: newPreset.name.trim(),
            amount,
            categoryId: newPreset.categoryId,
            icon: newPreset.icon
        });

        setNewPreset({ name: '', amount: '', categoryId: 0, icon: '💰' });
        setShowAddNew(false);
        loadData();
    }

    function handleDeletePreset(id: number) {
        setDeletePresetId(id);
    }

    async function confirmDeletePreset() {
        if (deletePresetId === null) return;
        setDeletingPreset(true);
        try {
            await deleteQuickAddPreset(deletePresetId);
            setDeletePresetId(null);
            loadData();
        } finally {
            setDeletingPreset(false);
        }
    }

    const getCategoryById = (id: number) => categories.find(c => c.id === id);
    const getPresetLabel = (preset: QuickAddPreset, category?: Category) =>
        `Add ${preset.name} expense, ${category?.name ?? 'uncategorized'}, ${preset.amount.toFixed(2)} euros`;

    if (variant === 'sidebar') {
        return (
            <div className={`quick-add-sidebar ${isOpen ? 'is-open' : ''}`}>
                <div className="panel-header py-xs px-md flex items-center justify-between">
                    <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls="quick-add-sidebar-presets"
                            className="flex flex-1 items-center gap-2 cursor-pointer hover:bg-concrete/50 transition-colors bg-transparent border-0 text-ink"
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        <ChevronRight 
                            size={14} 
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        />
                        <span className="panel-title">QUICK ADD</span>
                    </button>
                    {isOpen && (
                        <button
                            type="button"
                            aria-label={isEditing ? "Done editing presets" : "Edit presets"}
                            className={`p-1 hover:bg-concrete rounded-sm transition-colors ${isEditing ? 'text-ink' : 'text-muted'}`}
                            onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
                            title={isEditing ? "Done editing" : "Edit preset"}
                        >
                            <Settings size={12} />
                        </button>
                    )}
                </div>

                {isOpen && (
                    <div id="quick-add-sidebar-presets" className="flex flex-col animate-slideDown">
                        <div className="flex flex-col">
                            {presets.map(preset => {
                                const category = getCategoryById(preset.categoryId);
                                const isSuccess = addingSuccess === preset.id;

                                return (
                                    <div key={preset.id} className="relative group">
                                        <button
                                            type="button"
                                            className={`preset-item-sidebar ${isSuccess ? 'success' : ''}`}
                                            onClick={() => handleQuickAdd(preset)}
                                            aria-label={getPresetLabel(preset, category)}
                                            disabled={addingPresetId !== null}
                                            aria-busy={addingPresetId === preset.id}
                                        >
                                            <div className="flex items-center gap-sm flex-1 min-w-0">
                                                <span className="text-lg">
                                                    {isSuccess ? <Check size={16} className="text-success" /> : preset.icon}
                                                </span>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-medium text-ink truncate">{preset.name}</span>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: category?.color }} />
                                                        <span className="text-[9px] font-mono text-muted uppercase">{category?.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono font-bold">-€{preset.amount.toFixed(0)}</span>
                                        </button>

                                        {isEditing && (
                                            <button
                                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-paper shadow-sm border border-border text-danger hover:bg-danger hover:text-white transition-all z-10 rounded-sm"
                                                onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                                aria-label={`Delete ${preset.name} preset`}
                                                title="Delete preset"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            className="w-full py-sm px-md flex items-center gap-2 text-ink hover:bg-concrete transition-all border-t border-border mt-1"
                            onClick={(e) => { e.stopPropagation(); setShowAddNew(true); }}
                            aria-label="Create new preset"
                            title="Create new preset"
                        >
                            <Plus size={12} />
                            <span className="text-[10px] font-mono uppercase tracking-wider">NEW PRESET</span>
                        </button>
                    </div>
                )}

                {showAddNew && <AddNewPresetModal 
                    newPreset={newPreset} 
                    setNewPreset={setNewPreset} 
                    onClose={() => setShowAddNew(false)} 
                    onSave={handleAddNewPreset}
                    categories={categories}
                />}
                <ConfirmDialog open={deletePresetId !== null} title="Delete quick-add preset?" description="The preset will be removed; existing transactions are unchanged." confirmLabel="Delete preset" danger busy={deletingPreset} onCancel={() => setDeletePresetId(null)} onConfirm={() => void confirmDeletePreset()} />
            </div>
        );
    }

    return (
        <>
            <div className="quick-add-container">
                <div className={`quick-add-panel ${isExpanded ? 'open' : 'closed'}`}>
                    <div className="panel-header">
                        <span className="panel-title">QUICK ADD</span>
                        <button
                            className={`btn-xs-icon ${isEditing ? 'text-ink' : 'text-muted'}`}
                            onClick={() => setIsEditing(!isEditing)}
                            title={isEditing ? "Done editing" : "Edit preset"}
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                    
                    <div className="panel-scroll">
                        {presets.length === 0 ? (
                            <div className="p-lg text-center text-muted">
                                <div className="font-mono text-xs">NO PRESETS</div>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {presets.map(preset => {
                                    const category = getCategoryById(preset.categoryId);
                                    const isSuccess = addingSuccess === preset.id;

                                    return (
                                        <div key={preset.id} className="relative group">
                                            <button
                                                type="button"
                                                className={`preset-item ${isSuccess ? 'bg-concrete' : ''}`}
                                                onClick={() => handleQuickAdd(preset)}
                                                disabled={addingPresetId !== null}
                                                aria-busy={addingPresetId === preset.id}
                                                aria-label={getPresetLabel(preset, category)}
                                            >
                                                <div className="preset-content">
                                                    <span className="preset-icon">
                                                        {isSuccess ? <Check size={20} className="text-success" /> : preset.icon}
                                                    </span>
                                                    <div className="preset-details">
                                                        <span className="preset-name">{preset.name}</span>
                                                        <div className="preset-category">
                                                            <div 
                                                                className="category-dot"
                                                                style={{ backgroundColor: category?.color || '#000' }}
                                                            />
                                                            <span>{category?.name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="preset-amount">
                                                    -€{preset.amount.toFixed(2)}
                                                </span>
                                            </button>

                                            {isEditing && (
                                                <button
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-paper shadow-sm border border-border text-danger hover:bg-danger hover:text-white transition-all z-10 rounded-sm"
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                                    aria-label={`Delete ${preset.name} preset`}
                                                    title="Delete preset"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <button
                        className="add-preset-btn"
                        onClick={() => setShowAddNew(true)}
                        aria-label="Create new preset"
                        title="Create new preset"
                    >
                        <Plus size={14} />
                        <span>Create new preset</span>
                    </button>
                </div>

                <button
                    className={`fab-toggle ${isExpanded ? 'active' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                    aria-label={isExpanded ? 'Close quick add panel' : 'Open quick add panel'}
                    aria-expanded={isExpanded}
                    title={isExpanded ? 'Close panel' : 'Open quick add'}
                >
                    <Plus size={24} />
                </button>
            </div>

            {showAddNew && <AddNewPresetModal 
                newPreset={newPreset} 
                setNewPreset={setNewPreset} 
                onClose={() => setShowAddNew(false)} 
                onSave={handleAddNewPreset}
                categories={categories}
            />}
            <ConfirmDialog open={deletePresetId !== null} title="Delete quick-add preset?" description="The preset will be removed; existing transactions are unchanged." confirmLabel="Delete preset" danger busy={deletingPreset} onCancel={() => setDeletePresetId(null)} onConfirm={() => void confirmDeletePreset()} />
        </>
    );
});

interface AddNewPresetModalProps {
    newPreset: { name: string; amount: string; categoryId: number; icon: string };
    setNewPreset: (v: { name: string; amount: string; categoryId: number; icon: string }) => void;
    onClose: () => void;
    onSave: () => void;
    categories: Category[];
}

function AddNewPresetModal({ newPreset, setNewPreset, onClose, onSave, categories }: AddNewPresetModalProps) {
    const parsedAmount = Number(newPreset.amount.replace(',', '.'));
    const isValid = Boolean(newPreset.name.trim()) && Number.isFinite(parsedAmount) && parsedAmount > 0 && newPreset.categoryId > 0;

    return (
        <Dialog titleId="preset-dialog-title" onClose={onClose} className="modal-condensed">
                <div className="panel-header">
                    <h2 id="preset-dialog-title" className="text-sm font-mono uppercase tracking-wider m-0">NEW PRESET</h2>
                    <button className="text-ink/50 hover:text-ink" onClick={onClose} aria-label="Close" title="Close">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-lg space-y-lg">
                    {/* Name */}
                    <div>
                        <label htmlFor="preset-name" className="text-[10px] font-mono uppercase text-muted mb-xs block">NAME</label>
                        <input
                            id="preset-name"
                            type="text"
                            className="input w-full"
                            placeholder="e.g. Coffee"
                            value={newPreset.name}
                            onChange={e => setNewPreset({ ...newPreset, name: e.target.value })}
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <label htmlFor="preset-amount" className="text-[10px] font-mono uppercase text-muted mb-xs block">AMOUNT</label>
                        <div className="relative">
                            <span className="absolute left-sm top-1/2 -translate-y-1/2 font-mono text-muted">€</span>
                            <input
                                type="number"
                                id="preset-amount"
                                className="input w-full pl-8 font-mono"
                                placeholder="1.00"
                                step="0.01"
                                min="0.01"
                                value={newPreset.amount}
                                onChange={e => setNewPreset({ ...newPreset, amount: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label htmlFor="preset-category" className="text-[10px] font-mono uppercase text-muted mb-xs block">CATEGORY</label>
                        <select
                            id="preset-category"
                            className="input w-full appearance-none rounded-none"
                            value={newPreset.categoryId}
                            onChange={e => setNewPreset({ ...newPreset, categoryId: parseInt(e.target.value) })}
                            title="Select category"
                        >
                            <option value={0}>SELECT...</option>
                            {categories.filter((c: Category) => !c.isIncome).map((c: Category) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-md border-t border-border flex justify-end gap-sm bg-concrete/30">
                    <button 
                        className="btn btn-secondary text-xs" 
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary text-xs flex items-center gap-2"
                        onClick={onSave}
                        disabled={!isValid}
                    >
                        <span>SAVE</span>
                        <ArrowRight size={12} />
                    </button>
                </div>
        </Dialog>
    );
}
