import { useState, useEffect } from 'react';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../db/database';
import type { Category } from '../types';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

const EMOJI_OPTIONS = ['🛒', '🍕', '🚕', '✈️', '⛽', '🏠', '💊', '💅', '👕', '🎮', '🎭', '📚', '💻', '📱', '🎁', '❤️', '💰', '💸', '📈', '📉', '📦', '🔄', '💡', '🔥', '🚌', '🏋️', '🤝', '🚬'];

const COLOR_OPTIONS = [
    '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4',
    '#00BCD4', '#009688', '#795548', '#607D8B', '#9E9E9E', '#757575'
];

export function CategoryManager() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formIcon, setFormIcon] = useState('📦');
    const [formColor, setFormColor] = useState('#6366f1');
    const [formKeywords, setFormKeywords] = useState('');
    const [formIsIncome, setFormIsIncome] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadCategories();
    }, []);

    async function loadCategories() {
        setLoading(true);
        try {
            const cats = await getCategories();
            setCategories(cats);
        } catch (err) {
            console.error('Error loading categories:', err);
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setFormName('');
        setFormIcon('📦');
        setFormColor('#6366f1');
        setFormKeywords('');
        setFormIsIncome(false);
        setError('');
    }

    function openEditForm(category: Category) {
        setEditingCategory(category);
        setFormName(category.name);
        setFormIcon(category.icon);
        setFormColor(category.color);
        setFormKeywords(category.keywords.join(', '));
        setFormIsIncome(category.isIncome);
        setShowAddForm(true);
    }

    function openAddForm() {
        resetForm();
        setEditingCategory(null);
        setShowAddForm(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) {
            setError('Il nome della categoria è obbligatorio');
            return;
        }

        setSaving(true);
        setError('');

        try {
            const keywords = formKeywords
                .split(',')
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0);

            if (editingCategory?.id) {
                await updateCategory(editingCategory.id, {
                    name: formName.trim(),
                    icon: formIcon,
                    color: formColor,
                    keywords,
                    isIncome: formIsIncome
                });
            } else {
                await addCategory({
                    name: formName.trim(),
                    icon: formIcon,
                    color: formColor,
                    keywords,
                    isIncome: formIsIncome,
                    isDefault: false
                });
            }

            setShowAddForm(false);
            resetForm();
            setEditingCategory(null);
            loadCategories();
        } catch (err) {
            setError('Errore durante il salvataggio');
            console.error('Error saving category:', err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: number) {
        try {
            await deleteCategory(id);
            setDeleteConfirm(null);
            loadCategories();
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'eliminazione');
        }
    }

    const expenseCategories = categories.filter(c => !c.isIncome);
    const incomeCategories = categories.filter(c => c.isIncome);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">Categorie</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
                        {categories.length} categorie totali
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openAddForm}>
                    <Plus size={16} />
                    Nuova categoria
                </button>
            </div>

            {/* Expense Categories */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">💸 Categorie Spese ({expenseCategories.length})</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                    {expenseCategories.map(cat => (
                        <div
                            key={cat.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-md)',
                                padding: 'var(--space-md)',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 'var(--radius-md)',
                                background: `${cat.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                flexShrink: 0
                            }}>
                                {cat.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {cat.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {cat.keywords.length} keywords
                                    {cat.isDefault && ' • Default'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ width: 32, height: 32 }}
                                    onClick={() => openEditForm(cat)}
                                >
                                    <Edit2 size={14} />
                                </button>
                                {!cat.isDefault && (
                                    deleteConfirm === cat.id ? (
                                        <button
                                            className="btn btn-danger btn-icon"
                                            style={{ width: 32, height: 32 }}
                                            onClick={() => handleDelete(cat.id!)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            style={{ width: 32, height: 32 }}
                                            onClick={() => setDeleteConfirm(cat.id!)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Income Categories */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">💰 Categorie Entrate ({incomeCategories.length})</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
                    {incomeCategories.map(cat => (
                        <div
                            key={cat.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-md)',
                                padding: 'var(--space-md)',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)'
                            }}
                        >
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 'var(--radius-md)',
                                background: `${cat.color}20`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                flexShrink: 0
                            }}>
                                {cat.icon}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {cat.name}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {cat.keywords.length} keywords
                                    {cat.isDefault && ' • Default'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    style={{ width: 32, height: 32 }}
                                    onClick={() => openEditForm(cat)}
                                >
                                    <Edit2 size={14} />
                                </button>
                                {!cat.isDefault && (
                                    deleteConfirm === cat.id ? (
                                        <button
                                            className="btn btn-danger btn-icon"
                                            style={{ width: 32, height: 32 }}
                                            onClick={() => handleDelete(cat.id!)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    ) : (
                                        <button
                                            className="btn btn-ghost btn-icon"
                                            style={{ width: 32, height: 32 }}
                                            onClick={() => setDeleteConfirm(cat.id!)}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">
                                {editingCategory ? 'Modifica categoria' : 'Nuova categoria'}
                            </h2>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowAddForm(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-grid">
                                    {error && (
                                        <div style={{
                                            padding: 'var(--space-md)',
                                            background: 'var(--danger-bg)',
                                            borderRadius: 'var(--radius-md)',
                                            color: 'var(--danger)'
                                        }}>
                                            {error}
                                        </div>
                                    )}

                                    <div className="input-group">
                                        <label className="input-label">Nome categoria</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="es. Shopping online"
                                            value={formName}
                                            onChange={e => setFormName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Icona</label>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 'var(--space-xs)',
                                            padding: 'var(--space-sm)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)',
                                            maxHeight: '120px',
                                            overflowY: 'auto'
                                        }}>
                                            {EMOJI_OPTIONS.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        border: formIcon === emoji ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                                                        background: formIcon === emoji ? 'var(--accent-primary)20' : 'transparent',
                                                        borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer',
                                                        fontSize: '1.25rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={() => setFormIcon(emoji)}
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">Colore</label>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 'var(--space-xs)',
                                            padding: 'var(--space-sm)',
                                            background: 'var(--bg-tertiary)',
                                            borderRadius: 'var(--radius-md)'
                                        }}>
                                            {COLOR_OPTIONS.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    style={{
                                                        width: 32,
                                                        height: 32,
                                                        border: formColor === color ? '3px solid white' : 'none',
                                                        background: color,
                                                        borderRadius: 'var(--radius-full)',
                                                        cursor: 'pointer',
                                                        boxShadow: formColor === color ? '0 0 0 2px var(--accent-primary)' : 'none'
                                                    }}
                                                    onClick={() => setFormColor(color)}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="input-group">
                                        <label className="input-label">
                                            Keywords (separati da virgola)
                                        </label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="es. amazon, ebay, aliexpress"
                                            value={formKeywords}
                                            onChange={e => setFormKeywords(e.target.value)}
                                        />
                                        <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            Le keywords vengono usate per la classificazione automatica
                                        </small>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                        <input
                                            type="checkbox"
                                            id="isIncome"
                                            checked={formIsIncome}
                                            onChange={e => setFormIsIncome(e.target.checked)}
                                            style={{ width: 20, height: 20 }}
                                        />
                                        <label htmlFor="isIncome" style={{ cursor: 'pointer' }}>
                                            Questa è una categoria per entrate
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                                    Annulla
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    <Save size={16} />
                                    {saving ? 'Salvataggio...' : 'Salva'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
