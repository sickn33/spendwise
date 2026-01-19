import { useState } from 'react';
import type { ImportPreviewResult, ImportPreviewItem } from '../services/importer';
import { X, Check, AlertTriangle, Copy, RefreshCw } from 'lucide-react';

interface ImportPreviewModalProps {
    preview: ImportPreviewResult;
    onConfirm: (updateExisting: boolean) => void;
    onCancel: () => void;
    importing: boolean;
}

export function ImportPreviewModal({ preview, onConfirm, onCancel, importing }: ImportPreviewModalProps) {
    const [updateExisting, setUpdateExisting] = useState(false);

    const getStatusIcon = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return <Check size={16} style={{ color: 'var(--success)' }} />;
            case 'duplicate': return <Copy size={16} style={{ color: 'var(--text-muted)' }} />;
            case 'modified': return <AlertTriangle size={16} style={{ color: 'var(--warning)' }} />;
        }
    };

    const getStatusLabel = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return 'Nuova';
            case 'duplicate': return 'Duplicata';
            case 'modified': return 'Modificata';
        }
    };

    const getStatusBg = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return 'var(--success-bg)';
            case 'duplicate': return 'var(--bg-glass)';
            case 'modified': return 'var(--warning-bg)';
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh' }}>
                <div className="modal-header">
                    <h2 className="modal-title">Anteprima Import</h2>
                    <button className="btn-icon" onClick={onCancel}>
                        <X size={20} />
                    </button>
                </div>

                {/* Summary */}
                <div style={{ 
                    display: 'flex', 
                    gap: 'var(--space-lg)', 
                    marginBottom: 'var(--space-lg)',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ 
                        padding: 'var(--space-md)', 
                        background: 'var(--success-bg)', 
                        borderRadius: 'var(--radius-md)',
                        flex: 1,
                        minWidth: '120px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success)' }}>
                            {preview.newCount}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nuove</div>
                    </div>
                    <div style={{ 
                        padding: 'var(--space-md)', 
                        background: 'var(--bg-glass)', 
                        borderRadius: 'var(--radius-md)',
                        flex: 1,
                        minWidth: '120px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {preview.duplicateCount}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Duplicate</div>
                    </div>
                    <div style={{ 
                        padding: 'var(--space-md)', 
                        background: 'var(--warning-bg)', 
                        borderRadius: 'var(--radius-md)',
                        flex: 1,
                        minWidth: '120px',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--warning)' }}>
                            {preview.modifiedCount}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Modificate</div>
                    </div>
                </div>

                {/* Update existing option */}
                {preview.modifiedCount > 0 && (
                    <label style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 'var(--space-sm)',
                        padding: 'var(--space-md)',
                        background: 'var(--warning-bg)',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: 'var(--space-lg)',
                        cursor: 'pointer'
                    }}>
                        <input 
                            type="checkbox" 
                            checked={updateExisting} 
                            onChange={e => setUpdateExisting(e.target.checked)}
                        />
                        <RefreshCw size={16} style={{ color: 'var(--warning)' }} />
                        <span>Aggiorna transazioni modificate ({preview.modifiedCount})</span>
                    </label>
                )}

                {/* Transaction list */}
                <div style={{ 
                    maxHeight: '300px', 
                    overflowY: 'auto',
                    marginBottom: 'var(--space-lg)'
                }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: 'var(--space-sm)', textAlign: 'left' }}>Stato</th>
                                <th style={{ padding: 'var(--space-sm)', textAlign: 'left' }}>Data</th>
                                <th style={{ padding: 'var(--space-sm)', textAlign: 'left' }}>Descrizione</th>
                                <th style={{ padding: 'var(--space-sm)', textAlign: 'right' }}>Importo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.items.slice(0, 50).map((item, idx) => (
                                <tr key={idx} style={{ 
                                    borderBottom: '1px solid var(--border-color)',
                                    opacity: item.status === 'duplicate' ? 0.5 : 1
                                }}>
                                    <td style={{ padding: 'var(--space-sm)' }}>
                                        <span style={{ 
                                            display: 'inline-flex', 
                                            alignItems: 'center', 
                                            gap: '4px',
                                            padding: '2px 8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: getStatusBg(item.status),
                                            fontSize: '0.8rem'
                                        }}>
                                            {getStatusIcon(item.status)}
                                            {getStatusLabel(item.status)}
                                        </span>
                                    </td>
                                    <td style={{ padding: 'var(--space-sm)', fontSize: '0.9rem' }}>
                                        {item.date.toLocaleDateString('it-IT')}
                                    </td>
                                    <td style={{ 
                                        padding: 'var(--space-sm)', 
                                        fontSize: '0.9rem',
                                        maxWidth: '200px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.description}
                                    </td>
                                    <td style={{ 
                                        padding: 'var(--space-sm)', 
                                        textAlign: 'right',
                                        fontWeight: 500,
                                        color: item.amount > 0 ? 'var(--success)' : 'var(--danger)'
                                    }}>
                                        {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2)} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {preview.items.length > 50 && (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 'var(--space-md)' }}>
                            ...e altre {preview.items.length - 50} transazioni
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={onCancel} disabled={importing}>
                        Annulla
                    </button>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => onConfirm(updateExisting)}
                        disabled={importing || preview.newCount === 0 && (!updateExisting || preview.modifiedCount === 0)}
                    >
                        {importing ? 'Importazione...' : `Importa ${preview.newCount} transazioni`}
                    </button>
                </div>
            </div>
        </div>
    );
}
