import { useState, useEffect, useCallback, memo } from 'react';
import { getQuickAddPresets, addTransaction, getCategories, addQuickAddPreset, deleteQuickAddPreset, initializeQuickAddPresets } from '../db/database';
import type { QuickAddPreset, Category } from '../types';
import { Plus, X, Settings, Check, Trash2, ArrowRight, ChevronRight } from 'lucide-react';

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
    const [showAddNew, setShowAddNew] = useState(false);
    const [newPreset, setNewPreset] = useState({ name: '', amount: '', categoryId: 0, icon: '💰' });

    const loadData = useCallback(async () => {
        await initializeQuickAddPresets();
        const [p, c] = await Promise.all([
            getQuickAddPresets(),
            getCategories()
        ]);
        setPresets(p);
        setCategories(c);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line
        loadData();
    }, [loadData]);

    async function handleQuickAdd(preset: QuickAddPreset) {
        if (isEditing) return;

        try {
            await addTransaction({
                date: new Date(),
                description: preset.name,
                details: 'Aggiunta rapida',
                amount: -preset.amount,
                currency: 'EUR',
                categoryId: preset.categoryId,
                isRecurring: false,
                tags: ['quick-add'],
                account: '',
                isContabilized: true
            });

            setAddingSuccess(preset.id!);
            setTimeout(() => {
                setAddingSuccess(null);
                onTransactionAdded();
            }, 1000);
        } catch (error) {
            console.error('Error adding transaction:', error);
        }
    }

    async function handleAddNewPreset() {
        if (!newPreset.name || !newPreset.amount || !newPreset.categoryId) return;

        await addQuickAddPreset({
            name: newPreset.name,
            amount: parseFloat(newPreset.amount),
            categoryId: newPreset.categoryId,
            icon: newPreset.icon
        });

        setNewPreset({ name: '', amount: '', categoryId: 0, icon: '💰' });
        setShowAddNew(false);
        loadData();
    }

    async function handleDeletePreset(id: number) {
        await deleteQuickAddPreset(id);
        loadData();
    }

    const getCategoryById = (id: number) => categories.find(c => c.id === id);

    if (variant === 'sidebar') {
        return (
            <div className={`quick-add-sidebar ${isOpen ? 'is-open' : ''}`}>
                <div 
                    className="panel-header py-xs px-md flex items-center justify-between cursor-pointer hover:bg-concrete/50 transition-colors"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <ChevronRight 
                            size={14} 
                            className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                        />
                        <span className="panel-title">AGGIUNTA RAPIDA</span>
                    </div>
                    {isOpen && (
                        <button
                            className={`p-1 hover:bg-concrete rounded-sm transition-colors ${isEditing ? 'text-ink' : 'text-muted'}`}
                            onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
                            title={isEditing ? "Fine modifica" : "Modifica preset"}
                        >
                            <Settings size={12} />
                        </button>
                    )}
                </div>

                {isOpen && (
                    <div className="flex flex-col animate-slideDown">
                        <div className="flex flex-col">
                            {presets.map(preset => {
                                const category = getCategoryById(preset.categoryId);
                                const isSuccess = addingSuccess === preset.id;

                                return (
                                    <div key={preset.id} className="relative group">
                                        <div
                                            className={`preset-item-sidebar ${isSuccess ? 'success' : ''}`}
                                            onClick={() => handleQuickAdd(preset)}
                                        >
                                            <div className="flex items-center gap-sm flex-1 min-w-0">
                                                <span className="text-lg">
                                                    {isSuccess ? <Check size={16} className="text-success" /> : preset.icon}
                                                </span>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-medium text-ink truncate">{preset.name}</span>
                                                    <div className="flex items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: category?.color }} />
                                                        <span className="text-[9px] font-mono opacity-50 uppercase">{category?.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono font-bold">-€{preset.amount.toFixed(0)}</span>
                                        </div>

                                        {isEditing && (
                                            <button
                                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-paper shadow-sm border border-border text-danger hover:bg-danger hover:text-white transition-all z-10 rounded-sm"
                                                onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                                title="Elimina preset"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <button
                            className="w-full py-sm px-md flex items-center gap-2 text-ink/40 hover:text-ink hover:bg-concrete transition-all border-t border-border mt-1"
                            onClick={(e) => { e.stopPropagation(); setShowAddNew(true); }}
                            title="Crea nuovo preset"
                        >
                            <Plus size={12} />
                            <span className="text-[10px] font-mono uppercase tracking-wider">NUOVO PRESET</span>
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
            </div>
        );
    }

    return (
        <>
            <div className="quick-add-container">
                <div className={`quick-add-panel ${isExpanded ? 'open' : 'closed'}`}>
                    <div className="panel-header">
                        <span className="panel-title">AGGIUNTA RAPIDA</span>
                        <button
                            className={`btn-xs-icon ${isEditing ? 'text-ink' : 'text-muted'}`}
                            onClick={() => setIsEditing(!isEditing)}
                            title={isEditing ? "Fine modifica" : "Modifica preset"}
                        >
                            <Settings size={14} />
                        </button>
                    </div>
                    
                    <div className="panel-scroll">
                        {presets.length === 0 ? (
                            <div className="p-lg text-center opacity-40">
                                <div className="font-mono text-xs">NESSUN PRESET</div>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {presets.map(preset => {
                                    const category = getCategoryById(preset.categoryId);
                                    const isSuccess = addingSuccess === preset.id;

                                    return (
                                        <div key={preset.id} className="relative group">
                                            <div
                                                className={`preset-item ${isSuccess ? 'bg-concrete' : ''}`}
                                                onClick={() => handleQuickAdd(preset)}
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
                                            </div>

                                            {isEditing && (
                                                <button
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-paper shadow-sm border border-border text-danger hover:bg-danger hover:text-white transition-all z-10 rounded-sm"
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                                    title="Elimina preset"
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
                        title="Crea nuovo preset"
                    >
                        <Plus size={14} />
                        <span>CREA NUOVO PRESET</span>
                    </button>
                </div>

                <button
                    className={`fab-toggle ${isExpanded ? 'active' : ''}`}
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Chiudi pannello" : "Apertura rapida"}
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
        </>
    );
});

interface AddNewPresetModalProps {
    newPreset: { name: string; amount: string; categoryId: number; icon: string };
    setNewPreset: (v: any) => void;
    onClose: () => void;
    onSave: () => void;
    categories: Category[];
}

function AddNewPresetModal({ newPreset, setNewPreset, onClose, onSave, categories }: AddNewPresetModalProps) {
    return (
        <div className="fixed inset-0 bg-paper/90 backdrop-blur-sm z-[60] flex items-center justify-center p-md modal-overlay" onClick={onClose}>
            <div className="modal-condensed" onClick={e => e.stopPropagation()}>
                <div className="panel-header">
                    <h2 className="text-sm font-mono uppercase tracking-wider m-0">NUOVO_PRESET</h2>
                    <button className="text-ink/50 hover:text-ink" onClick={onClose} title="Chiudi">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-lg space-y-lg">
                    {/* Name */}
                    <div>
                        <label className="text-[10px] font-mono uppercase opacity-60 mb-xs block">NOME</label>
                        <input
                            type="text"
                            className="input w-full"
                            placeholder="es. Caffè"
                            value={newPreset.name}
                            onChange={e => setNewPreset({ ...newPreset, name: e.target.value })}
                        />
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="text-[10px] font-mono uppercase opacity-60 mb-xs block">IMPORTO</label>
                        <div className="relative">
                            <span className="absolute left-sm top-1/2 -translate-y-1/2 font-mono opacity-40">€</span>
                            <input
                                type="number"
                                className="input w-full pl-8 font-mono"
                                placeholder="1.00"
                                step="0.01"
                                value={newPreset.amount}
                                onChange={e => setNewPreset({ ...newPreset, amount: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-[10px] font-mono uppercase opacity-60 mb-xs block">CATEGORIA</label>
                        <select
                            className="input w-full appearance-none rounded-none"
                            value={newPreset.categoryId}
                            onChange={e => setNewPreset({ ...newPreset, categoryId: parseInt(e.target.value) })}
                            title="Seleziona categoria"
                        >
                            <option value={0}>SELEZIONA...</option>
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
                        ANNULLA
                    </button>
                    <button
                        className="btn btn-primary text-xs flex items-center gap-2"
                        onClick={onSave}
                        disabled={!newPreset.name || !newPreset.amount || !newPreset.categoryId}
                    >
                        <span>SALVA</span>
                        <ArrowRight size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
}
