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
            <div className={`
                fixed bottom-md right-md z-50 flex flex-col items-end gap-sm transition-all duration-300
                ${isExpanded ? 'translate-y-0' : 'translate-y-0'}
            `}>
                {/* Expanded Actions Panel */}
                <div className={`
                    bg-paper structural-border shadow-2xl overflow-hidden transition-all duration-300 origin-bottom-right
                    ${isExpanded ? 'opacity-100 scale-100 mb-2' : 'opacity-0 scale-95 h-0 mb-0 pointer-events-none'}
                `}>
                    <div className="w-64">
                        {/* Header */}
                        <div className="flex items-center justify-between p-sm border-b border-border bg-paper">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-ink/50">AGGIUNTA RAPIDA</span>
                            <button
                                className={`p-1 hover:bg-concrete transition-colors ${isEditing ? 'text-ink bg-concrete' : 'text-ink/40'}`}
                                onClick={() => setIsEditing(!isEditing)}
                                title={isEditing ? "Fine modifica" : "Modifica preset"}
                            >
                                <Settings size={12} />
                            </button>
                        </div>
                        
                        {/* Grid */}
                        <div className="grid grid-cols-2 gap-px bg-border border-b border-border">
                            {presets.map(preset => {
                                const category = getCategoryById(preset.categoryId);
                                const isSuccess = addingSuccess === preset.id;

                                return (
                                    <div key={preset.id} className="relative bg-paper group">
                                        <button
                                            className={`
                                                w-full p-sm text-left transition-all hover:bg-concrete h-20 flex flex-col justify-between
                                                ${isSuccess ? 'bg-concrete' : ''}
                                            `}
                                            onClick={() => handleQuickAdd(preset)}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <span className="text-lg filter grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">{isSuccess ? <Check size={18} /> : preset.icon}</span>
                                                <span className="font-mono text-[10px] opacity-50">€{preset.amount.toFixed(2)}</span>
                                            </div>
                                            <div className="font-mono text-[10px] uppercase truncate w-full pt-2 border-t border-transparent group-hover:border-ink/10 mt-auto">
                                                {preset.name}
                                            </div>
                                        </button>

                                        {/* Category Stripe */}
                                        <div 
                                            className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-300"
                                            style={{ backgroundColor: category?.color || '#000' }}
                                        />

                                        {isEditing && (
                                            <button
                                                className="absolute top-1 right-1 p-1 bg-paper border border-border hover:bg-red-50 hover:border-red-500 hover:text-red-500 transition-colors z-10"
                                                onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {isEditing && (
                                <button
                                    className="h-20 bg-paper hover:bg-concrete flex flex-col items-center justify-center gap-1 group"
                                    onClick={() => setShowAddNew(true)}
                                >
                                    <div className="w-6 h-6 border border-dashed border-ink/30 flex items-center justify-center rounded-none group-hover:border-ink/60 transition-colors">
                                        <Plus size={12} className="opacity-40 group-hover:opacity-100" />
                                    </div>
                                    <span className="font-mono text-[9px] uppercase opacity-40 group-hover:opacity-100">NUOVO</span>
                                </button>
                            )}
                        </div>
                        
                        {/* Status Bar */}
                        <div className="p-xs bg-concrete/30 text-center">
                            <span className="font-mono text-[9px] text-ink/30 uppercase">
                                {presets.length} PRESET ATTIVI
                            </span>
                        </div>
                    </div>
                </div>

                {/* Main Toggle Button (Floating Action Style) */}
                <button
                    className={`
                        h-12 flex items-center gap-3 px-4 bg-paper structural-border shadow-xl hover:shadow-2xl transition-all duration-300 group
                        ${isExpanded ? 'bg-ink text-paper border-ink' : 'hover:bg-concrete'}
                    `}
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Chiudi pannello" : "Apertura rapida"}
                >
                    <span className={`font-mono text-xs uppercase tracking-wider ${isExpanded ? 'text-paper' : 'text-ink'}`}>
                        {isExpanded ? 'CHIUDI' : 'AGGIUNTA RAPIDA'}
                    </span>
                    <div className={`
                        w-6 h-6 flex items-center justify-center border transition-colors
                        ${isExpanded ? 'border-paper/30 bg-paper/10' : 'border-ink/20 bg-concrete group-hover:border-ink/40'}
                    `}>
                        {isExpanded ? <X size={14} /> : <Plus size={14} />}
                    </div>
                </button>
            </div>

            {/* KEEP EXISTING ADD NEW MODAL */}
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
