import { useState, useEffect, memo } from 'react';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../db/database';
import type { Category } from '../types';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

const EMOJI_OPTIONS = ['🛒', '🍕', '🚕', '✈️', '⛽', '🏠', '💊', '💅', '👕', '🎮', '🎭', '📚', '💻', '📱', '🎁', '❤️', '💰', '💸', '📈', '📉', '📦', '🔄', '💡', '🔥', '🚌', '🏋️', '🤝', '🚬'];

const COLOR_OPTIONS = [
    '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4',
    '#00BCD4', '#009688', '#795548', '#607D8B', '#9E9E9E', '#757575'
];

export const CategoryManager = memo(function CategoryManager() {
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Errore durante l\'eliminazione');
        }
    }

    const expenseCategories = categories.filter(c => !c.isIncome);
    const incomeCategories = categories.filter(c => c.isIncome);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-xl max-w-4xl mx-auto">
            <div className="flex items-center justify-between pb-md border-b border-border">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">GESTIONE_CATEGORIE</h1>
                    <p className="text-xs font-mono text-muted uppercase tracking-wider mt-1">
                        SYSTEM_CONFIGURATION_V1.0
                    </p>
                </div>
                <button 
                    className="btn btn-primary text-xs uppercase structural-border"
                    onClick={openAddForm}
                >
                    <Plus size={16} className="mr-xs" />
                    NUOVA_CATEGORIA
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
                {/* Expense Categories */}
                <div className="space-y-md">
                    <div className="flex items-center justify-between border-l-2 border-primary pl-2">
                        <h3 className="text-xs font-mono uppercase text-muted">
                            CATEGORIE_SPESE
                        </h3>
                        <span className="text-tiny font-mono text-muted">
                            COUNT: {expenseCategories.length}
                        </span>
                    </div>
                    
                    <div className="grid gap-sm">
                        {expenseCategories.map(cat => (
                            <div
                                key={cat.id}
                                className="group flex items-center gap-md p-sm bg-paper structural-border hover:border-ink transition-colors"
                            >
                                <div 
                                    className="w-8 h-8 flex items-center justify-center rounded-sm text-lg border border-border"
                                    style={{ backgroundColor: `${cat.color}15`, color: cat.color, borderColor: `${cat.color}30` }}
                                >
                                    {cat.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-mono text-sm font-bold truncate pr-2">
                                        {cat.name}
                                    </div>
                                    <div className="text-tiny text-muted truncate">
                                        {cat.keywords.length > 0 ? cat.keywords.join(', ') : 'NO_KEYWORDS'}
                                    </div>
                                </div>
                                <div className="flex items-center transition-opacity group-hover:opacity-100">
                                    <button
                                        className="p-1.5 hover:bg-concrete/20 text-muted hover:text-ink transition-colors"
                                        onClick={() => openEditForm(cat)}
                                        title="MODIFICA"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    {!cat.isDefault && (
                                        deleteConfirm === cat.id ? (
                                            <button
                                                className="p-1.5 bg-danger text-white transition-colors"
                                                onClick={() => handleDelete(cat.id!)}
                                                title="CONFERMA"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                className="p-1.5 hover:bg-danger/10 text-muted hover:text-danger transition-colors"
                                                onClick={() => setDeleteConfirm(cat.id!)}
                                                title="ELIMINA"
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
                <div className="space-y-md">
                    <div className="flex items-center justify-between border-l-2 border-success pl-2">
                        <h3 className="text-xs font-mono uppercase text-muted">
                            CATEGORIE_ENTRATE
                        </h3>
                        <span className="text-tiny font-mono text-muted">
                            COUNT: {incomeCategories.length}
                        </span>
                    </div>

                    <div className="grid gap-sm">
                        {incomeCategories.map(cat => (
                            <div
                                key={cat.id}
                                className="group flex items-center gap-md p-sm bg-paper structural-border hover:border-ink transition-colors"
                            >
                                <div 
                                    className="w-8 h-8 flex items-center justify-center rounded-sm text-lg border border-border"
                                    style={{ backgroundColor: `${cat.color}15`, color: cat.color, borderColor: `${cat.color}30` }}
                                >
                                    {cat.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-mono text-sm font-bold truncate pr-2">
                                        {cat.name}
                                    </div>
                                    <div className="text-tiny text-muted truncate">
                                        {cat.keywords.length > 0 ? cat.keywords.join(', ') : 'NO_KEYWORDS'}
                                    </div>
                                </div>
                                <div className="flex items-center transition-opacity group-hover:opacity-100">
                                    <button
                                        className="p-1.5 hover:bg-concrete/20 text-muted hover:text-ink transition-colors"
                                        onClick={() => openEditForm(cat)}
                                        title="MODIFICA"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    {!cat.isDefault && (
                                        deleteConfirm === cat.id ? (
                                            <button
                                                className="p-1.5 bg-danger text-white transition-colors"
                                                onClick={() => handleDelete(cat.id!)}
                                                title="CONFERMA"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        ) : (
                                            <button
                                                className="p-1.5 hover:bg-danger/10 text-muted hover:text-danger transition-colors"
                                                onClick={() => setDeleteConfirm(cat.id!)}
                                                title="ELIMINA"
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
            </div>

            {/* Add/Edit Modal */}
            {showAddForm && (
                <div className="fixed inset-0 bg-paper/60 backdrop-blur-sm z-50 flex items-center justify-center p-md" onClick={() => setShowAddForm(false)}>
                    <div 
                        className="bg-paper structural-border w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95 duration-200" 
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-md border-b border-border bg-subtle">
                            <h2 className="text-sm font-mono font-bold uppercase tracking-wider">
                                {editingCategory ? 'CONFIGURAZIONE_CATEGORIA' : 'NUOVA_CATEGORIA'}
                            </h2>
                            <button 
                                className="text-muted hover:text-ink transition-colors"
                                onClick={() => setShowAddForm(false)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-lg space-y-lg">
                            {error && (
                                <div className="p-sm bg-danger/5 border border-danger/20 text-danger text-xs font-mono">
                                    ERROR: {error}
                                </div>
                            )}

                            <div className="space-y-xs">
                                <label className="text-tiny font-mono uppercase text-muted">NOME_CATEGORIA</label>
                                <input
                                    type="text"
                                    className="w-full bg-concrete/20 border-b border-border focus:border-ink py-xs font-mono text-sm focus:outline-none placeholder:text-muted/50"
                                    placeholder="NOME_CATEGORIA"
                                    value={formName}
                                    onChange={e => setFormName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-md">
                                <div className="space-y-xs">
                                    <label className="text-tiny font-mono uppercase text-muted">ICONA_ASSET</label>
                                    <div className="h-32 overflow-y-auto border border-border p-xs bg-concrete/10 grid grid-cols-5 gap-xs">
                                        {EMOJI_OPTIONS.map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                className={`aspect-square flex items-center justify-center rounded-sm text-lg transition-colors ${formIcon === emoji ? 'bg-primary text-white' : 'hover:bg-concrete/20'}`}
                                                onClick={() => setFormIcon(emoji)}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-xs">
                                    <label className="text-tiny font-mono uppercase text-muted">COLORE_IDENTIFICATIVO</label>
                                    <div className="h-32 overflow-y-auto border border-border p-xs bg-concrete/10 grid grid-cols-4 gap-xs content-start">
                                        {COLOR_OPTIONS.map(color => (
                                            <button
                                                key={color}
                                                type="button"
                                                className={`aspect-square rounded-full transition-transform ${formColor === color ? 'ring-2 ring-primary scale-90' : 'hover:scale-110'}`}
                                                style={{ backgroundColor: color }}
                                                onClick={() => setFormColor(color)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-xs">
                                <label className="text-tiny font-mono uppercase text-muted">KEYWORDS_AUTOMAZIONE</label>
                                <input
                                    type="text"
                                    className="w-full bg-concrete/20 border-b border-border focus:border-ink py-xs font-mono text-sm focus:outline-none placeholder:text-muted/50"
                                    placeholder="ES: AMAZON, PAYPAL, STRIPE"
                                    value={formKeywords}
                                    onChange={e => setFormKeywords(e.target.value)}
                                />
                                <p className="text-[10px] text-muted font-mono mt-1">
                                    SEPARATED_BY_COMMA
                                </p>
                            </div>

                            <label className="flex items-center gap-sm cursor-pointer group p-sm border border-border hover:border-ink transition-colors">
                                <div className={`w-4 h-4 border transition-colors ${formIsIncome ? 'bg-primary border-primary' : 'border-muted group-hover:border-ink'}`}>
                                    {formIsIncome && <div className="w-full h-full flex items-center justify-center text-white text-[10px]">✓</div>}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={formIsIncome}
                                    onChange={e => setFormIsIncome(e.target.checked)}
                                />
                                <span className="text-xs font-mono uppercase text-muted group-hover:text-ink transition-colors">IS_INCOME_SOURCE</span>
                            </label>

                            <div className="flex gap-sm pt-md border-t border-border">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary flex-1 text-xs uppercase"
                                    onClick={() => setShowAddForm(false)}
                                >
                                    ANNULLA
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary flex-1 text-xs uppercase structural-border"
                                    disabled={saving}
                                >
                                    <Save size={16} className="mr-xs" />
                                    {saving ? 'SAVING...' : 'SALVA_CONFIGURAZIONE'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
});
