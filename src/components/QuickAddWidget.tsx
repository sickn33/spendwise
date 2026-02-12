import { useState, useEffect, useCallback, memo } from 'react';
import { getQuickAddPresets, addTransaction, getCategories, addQuickAddPreset, deleteQuickAddPreset, initializeQuickAddPresets } from '../db/database';
import type { QuickAddPreset, Category } from '../types';
import { Plus, X, Settings, Check } from 'lucide-react';

interface QuickAddWidgetProps {
    onTransactionAdded: () => void;
}

export const QuickAddWidget = memo(function QuickAddWidget({ onTransactionAdded }: QuickAddWidgetProps) {
    const [presets, setPresets] = useState<QuickAddPreset[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
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

    return (
        <>
            <div className={`fixed bottom-md left-1/2 -translate-x-1/2 flex items-center gap-px bg-border structural-border z-50 shadow-none transition-all duration-300 ${isExpanded ? 'w-auto' : 'w-auto'}`}>
                {/* Main Toggle */}
                <button
                    className="p-sm bg-paper hover:bg-concrete text-ink flex items-center gap-xs min-w-[140px] justify-center"
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Chiudi" : "Espandi"}
                >
                    <span className="font-mono text-xs uppercase tracking-wider">
                        {isExpanded ? 'CHIUDI_PANNELLO' : '⚡ AGGIUNTA_RAPIDA'}
                    </span>
                </button>

                {/* Expanded Actions */}
                {isExpanded && (
                    <>
                        <button
                            className={`p-sm bg-paper hover:bg-concrete text-ink flex items-center justify-center w-10 ${isEditing ? 'bg-concrete' : ''}`}
                            onClick={() => setIsEditing(!isEditing)}
                            title={isEditing ? "Fine modifica" : "Modifica preset"}
                        >
                            <Settings size={14} />
                        </button>
                        
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-sm w-72 bg-paper structural-border shadow-none overflow-hidden">
                            <div className="grid grid-cols-2 gap-px bg-border p-px">
                                {presets.map(preset => {
                                    const category = getCategoryById(preset.categoryId);
                                    const isSuccess = addingSuccess === preset.id;

                                    return (
                                        <button
                                            key={preset.id}
                                            className={`relative p-sm bg-paper hover:bg-concrete text-left transition-colors group ${isSuccess ? 'bg-concrete' : ''}`}
                                            onClick={() => handleQuickAdd(preset)}
                                        >
                                            <div className="flex items-center justify-between mb-xs">
                                                <span className="text-lg">{isSuccess ? <Check size={18} /> : preset.icon}</span>
                                                <span className="font-mono text-xs opacity-60">€{preset.amount.toFixed(2)}</span>
                                            </div>
                                            <div className="font-mono text-xs uppercase truncate pr-4">
                                                {preset.name}
                                            </div>
                                            
                                            {/* Category Indicator */}
                                            <div 
                                                className="absolute top-0 right-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                style={{ backgroundColor: category?.color }}
                                            />

                                            {isEditing && (
                                                <div
                                                    className="absolute top-0 right-0 p-1 bg-paper/80 hover:bg-paper text-ink z-10"
                                                    onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                                >
                                                    <X size={12} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}

                                {isEditing && (
                                    <button
                                        className="p-sm bg-paper hover:bg-concrete flex flex-col items-center justify-center gap-xs min-h-[60px]"
                                        onClick={() => setShowAddNew(true)}
                                    >
                                        <Plus size={20} className="opacity-40" />
                                        <span className="font-mono text-[10px] uppercase opacity-40">NUOVO</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Add New Preset Modal (Reused structural modal style) */}
            {showAddNew && (
                <div className="fixed inset-0 bg-paper/90 backdrop-blur-sm z-[60] flex items-center justify-center p-md" onClick={() => setShowAddNew(false)}>
                    <div className="w-full max-w-sm bg-paper structural-border shadow-none" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-md border-b border-border">
                            <h2 className="text-sm font-mono uppercase tracking-wider">NUOVO_PRESET</h2>
                            <button className="btn btn-ghost btn-icon structural-border border-0" onClick={() => setShowAddNew(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-md space-y-md">
                            {/* Name */}
                            <div>
                                <label className="text-tiny font-mono uppercase opacity-60 mb-xs block">NOME</label>
                                <input
                                    type="text"
                                    className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink"
                                    placeholder="es. Caffè"
                                    value={newPreset.name}
                                    onChange={e => setNewPreset({ ...newPreset, name: e.target.value })}
                                />
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="text-tiny font-mono uppercase opacity-60 mb-xs block">IMPORTO</label>
                                <div className="relative">
                                    <span className="absolute left-sm top-1/2 -translate-y-1/2 font-mono opacity-40">€</span>
                                    <input
                                        type="number"
                                        className="w-full bg-paper border border-border p-sm pl-6 font-mono text-sm focus:outline-none focus:border-ink"
                                        placeholder="1.00"
                                        step="0.01"
                                        value={newPreset.amount}
                                        onChange={e => setNewPreset({ ...newPreset, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-tiny font-mono uppercase opacity-60 mb-xs block">CATEGORIA</label>
                                <select
                                    className="w-full bg-paper border border-border p-sm font-mono text-sm focus:outline-none focus:border-ink appearance-none rounded-none"
                                    value={newPreset.categoryId}
                                    onChange={e => setNewPreset({ ...newPreset, categoryId: parseInt(e.target.value) })}
                                    title="Seleziona categoria"
                                >
                                    <option value={0}>SELEZIONA...</option>
                                    {categories.filter(c => !c.isIncome).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-md border-t border-border flex justify-end gap-sm bg-concrete/20">
                            <button 
                                className="btn btn-secondary text-xs uppercase tracking-wider" 
                                onClick={() => setShowAddNew(false)}
                            >
                                ANNULLA
                            </button>
                            <button
                                className="btn btn-primary text-xs uppercase tracking-wider"
                                onClick={handleAddNewPreset}
                                disabled={!newPreset.name || !newPreset.amount || !newPreset.categoryId}
                            >
                                SALVA
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});
