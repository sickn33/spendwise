import { useState, useEffect } from 'react';
import { getQuickAddPresets, addTransaction, getCategories, addQuickAddPreset, deleteQuickAddPreset, initializeQuickAddPresets } from '../db/database';
import type { QuickAddPreset, Category } from '../types';
import { Plus, X, Settings, Check } from 'lucide-react';

interface QuickAddWidgetProps {
    onTransactionAdded: () => void;
}

export function QuickAddWidget({ onTransactionAdded }: QuickAddWidgetProps) {
    const [presets, setPresets] = useState<QuickAddPreset[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [addingSuccess, setAddingSuccess] = useState<number | null>(null);
    const [showAddNew, setShowAddNew] = useState(false);
    const [newPreset, setNewPreset] = useState({ name: '', amount: '', categoryId: 0, icon: '💰' });

    async function loadData() {
        await initializeQuickAddPresets();
        const [p, c] = await Promise.all([
            getQuickAddPresets(),
            getCategories()
        ]);
        setPresets(p);
        setCategories(c);
    }

    useEffect(() => {
        loadData();
    }, []);

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
            {/* Quick Add Bar - Fixed at bottom on mobile, floating on desktop */}
            <div className={`quick-add-bar ${isExpanded ? 'expanded' : ''}`}>
                <div className="quick-add-header" onClick={() => setIsExpanded(!isExpanded)}>
                    <span style={{ fontWeight: 600 }}>⚡ Aggiunta Rapida</span>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                        {isExpanded && (
                            <button
                                className="btn btn-ghost btn-icon"
                                onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
                                style={{ width: 28, height: 28 }}
                            >
                                <Settings size={16} />
                            </button>
                        )}
                        <button
                            className="btn btn-ghost btn-icon"
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                            style={{ width: 28, height: 28, transform: isExpanded ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                </div>

                {isExpanded && (
                    <div className="quick-add-content">
                        <div className="quick-add-grid">
                            {presets.map(preset => {
                                const category = getCategoryById(preset.categoryId);
                                const isSuccess = addingSuccess === preset.id;

                                return (
                                    <div
                                        key={preset.id}
                                        className={`quick-add-item ${isSuccess ? 'success' : ''} ${isEditing ? 'editing' : ''}`}
                                        onClick={() => handleQuickAdd(preset)}
                                    >
                                        {isEditing && (
                                            <button
                                                className="quick-add-delete"
                                                onClick={(e) => { e.stopPropagation(); handleDeletePreset(preset.id!); }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        <div className="quick-add-icon">
                                            {isSuccess ? <Check size={20} /> : preset.icon}
                                        </div>
                                        <div className="quick-add-name">{preset.name}</div>
                                        <div className="quick-add-amount">€{preset.amount.toFixed(2)}</div>
                                        <div className="quick-add-category" style={{ color: category?.color }}>
                                            {category?.icon}
                                        </div>
                                    </div>
                                );
                            })}

                            {isEditing && (
                                <div
                                    className="quick-add-item add-new"
                                    onClick={() => setShowAddNew(true)}
                                >
                                    <Plus size={24} />
                                    <div className="quick-add-name">Aggiungi</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Add New Preset Modal */}
            {showAddNew && (
                <div className="modal-overlay" onClick={() => setShowAddNew(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Nuovo Preset</h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddNew(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nome</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="es. Caffè"
                                value={newPreset.name}
                                onChange={e => setNewPreset({ ...newPreset, name: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Importo (€)</label>
                            <input
                                type="number"
                                className="input"
                                placeholder="1.50"
                                step="0.01"
                                value={newPreset.amount}
                                onChange={e => setNewPreset({ ...newPreset, amount: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Categoria</label>
                            <select
                                className="input"
                                value={newPreset.categoryId}
                                onChange={e => setNewPreset({ ...newPreset, categoryId: parseInt(e.target.value) })}
                            >
                                <option value={0}>Seleziona categoria</option>
                                {categories.filter(c => !c.isIncome).map(c => (
                                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Icona</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                                {['☕', '🍝', '🚇', '🛒', '🍕', '🚕', '🎬', '💊', '⛽', '🍺', '🥪', '💰'].map(icon => (
                                    <button
                                        key={icon}
                                        type="button"
                                        className={`btn ${newPreset.icon === icon ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setNewPreset({ ...newPreset, icon })}
                                        style={{ width: 40, height: 40, fontSize: '1.2rem', padding: 0 }}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowAddNew(false)}>
                                Annulla
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAddNewPreset}
                                disabled={!newPreset.name || !newPreset.amount || !newPreset.categoryId}
                            >
                                Salva
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
