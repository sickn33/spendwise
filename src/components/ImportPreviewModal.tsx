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
            case 'new': return <Check size={16} className="text-success" />;
            case 'duplicate': return <Copy size={16} className="text-muted" />;
            case 'modified': return <AlertTriangle size={16} className="text-warning" />;
        }
    };

    const getStatusLabel = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return 'Nuova';
            case 'duplicate': return 'Duplicata';
            case 'modified': return 'Modificata';
        }
    };

    const getStatusBgClass = (status: ImportPreviewItem['status']) => {
        switch (status) {
            case 'new': return 'bg-success-light';
            case 'duplicate': return 'bg-glass';
            case 'modified': return 'bg-warning-light';
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal max-w-700 max-h-80vh" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Anteprima Import</h2>
                    <button 
                        className="btn-icon" 
                        onClick={onCancel}
                        title="Chiudi"
                        aria-label="Chiudi"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Summary */}
                <div className="flex gap-lg mb-lg flex-wrap">
                    <div className="summary-box bg-success-light">
                        <div className="font-xl font-semibold text-success">
                            {preview.newCount}
                        </div>
                        <div className="font-sm text-muted">Nuove</div>
                    </div>
                    <div className="summary-box bg-glass">
                        <div className="font-xl font-semibold text-muted">
                            {preview.duplicateCount}
                        </div>
                        <div className="font-sm text-muted">Duplicate</div>
                    </div>
                    <div className="summary-box bg-warning-light">
                        <div className="font-xl font-semibold text-warning">
                            {preview.modifiedCount}
                        </div>
                        <div className="font-sm text-muted">Modificate</div>
                    </div>
                </div>

                {/* Update existing option */}
                {preview.modifiedCount > 0 && (
                    <label className="flex items-center gap-sm p-md bg-warning-light border-radius-md mb-lg cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="checkbox-lg"
                            checked={updateExisting} 
                            onChange={e => setUpdateExisting(e.target.checked)}
                        />
                        <RefreshCw size={16} className="text-warning" />
                        <span>Aggiorna transazioni modificate ({preview.modifiedCount})</span>
                    </label>
                )}

                {/* Transaction list */}
                <div className="h-300-scroll mb-lg">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="p-sm text-left">Stato</th>
                                <th className="p-sm text-left">Data</th>
                                <th className="p-sm text-left">Descrizione</th>
                                <th className="p-sm text-right">Importo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preview.items.slice(0, 50).map((item, idx) => (
                                <tr key={idx} className={`border-b ${item.status === 'duplicate' ? 'opacity-50' : ''}`}>
                                    <td className="p-sm">
                                        <span className={`inline-flex items-center gap-xs px-sm py-xs border-radius-sm font-xs ${getStatusBgClass(item.status)}`}>
                                            {getStatusIcon(item.status)}
                                            {getStatusLabel(item.status)}
                                        </span>
                                    </td>
                                    <td className="p-sm font-sm">
                                        {item.date.toLocaleDateString('it-IT')}
                                    </td>
                                    <td className="p-sm font-sm text-ellipsis max-w-200">
                                        {item.description}
                                    </td>
                                    <td className={`p-sm text-right font-medium ${item.amount > 0 ? 'text-success' : 'text-danger'}`}>
                                        {item.amount > 0 ? '+' : ''}{item.amount.toFixed(2)} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {preview.items.length > 50 && (
                        <p className="text-muted text-center mt-md">
                            ...e altre {preview.items.length - 50} transazioni
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-md justify-end">
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
