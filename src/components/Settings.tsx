import { useCallback, useEffect, useRef, useState } from 'react';
import { importIsybankExcel, previewIsybankExcel, type ImportPreviewResult } from '../services/importer';
import { getTransactions, getCategories, clearAllTransactions } from '../db/database';
import { exportToExcel, exportToCSV } from '../services/importer';
import { ImportPreviewModal } from './ImportPreviewModal';
import {
    loadGmailSyncSettings,
    saveGmailSyncSettings,
    loadGmailToken,
    saveGmailToken,
    clearGmailToken,
    isGmailTokenValid,
    requestGmailAccessToken,
    syncIsybankTransactionsFromGmail,
    type GmailAccessToken,
    type GmailSyncSettings
} from '../services/gmailSync';
import {
    Upload,
    Download,
    FileJson,
    FileSpreadsheet,
    Trash2,
    Shield,
    Database,
    HardDrive,
    AlertTriangle,
    Mail,
    RefreshCcw,
    Link2Off
} from 'lucide-react';

const LAST_GMAIL_SYNC_KEY = 'spendwise-gmail-last-sync';

interface SettingsProps {
    onTransactionsImported?: () => void;
}

export function Settings({ onTransactionsImported }: SettingsProps) {
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: boolean; message: string } | null>(null);
    const [exporting, setExporting] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [gmailSettings, setGmailSettings] = useState<GmailSyncSettings>(() => loadGmailSyncSettings());
    const [gmailToken, setGmailToken] = useState<GmailAccessToken | null>(() => loadGmailToken());
    const [gmailSyncing, setGmailSyncing] = useState(false);
    const [gmailResult, setGmailResult] = useState<{ success: boolean; message: string } | null>(null);
    const [lastGmailSyncAt, setLastGmailSyncAt] = useState<string | null>(
        () => localStorage.getItem(LAST_GMAIL_SYNC_KEY)
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function handleFileSelect(file: File) {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
            setImportResult({ success: false, message: 'Per favore seleziona un file Excel (.xlsx o .xls)' });
            return;
        }

        setImporting(true);
        setImportResult(null);

        try {
            // Use preview instead of direct import
            const previewResult = await previewIsybankExcel(file);
            
            if (previewResult.success) {
                setPreview(previewResult);
                setPendingFile(file);
            } else {
                setImportResult({
                    success: false,
                    message: `Errore: ${previewResult.errors.join(', ')}`
                });
            }
        } catch (err) {
            setImportResult({
                success: false,
                message: `Errore durante l'analisi: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`
            });
        } finally {
            setImporting(false);
        }
    }

    async function handleConfirmImport(updateExisting: boolean) {
        if (!pendingFile) return;
        
        setImporting(true);
        try {
            const result = await importIsybankExcel(pendingFile);
            
            if (result.success) {
                setImportResult({
                    success: true,
                    message: `Importate ${result.imported} transazioni. ${result.skipped} duplicate saltate.${updateExisting && result.updated > 0 ? ` ${result.updated} aggiornate.` : ''}`
                });
                if (result.imported > 0) {
                    onTransactionsImported?.();
                }
            } else {
                setImportResult({
                    success: false,
                    message: `Errore: ${result.errors.join(', ')}`
                });
            }
        } catch (err) {
            setImportResult({
                success: false,
                message: `Errore durante l'import: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`
            });
        } finally {
            setImporting(false);
            setPreview(null);
            setPendingFile(null);
        }
    }

    async function handleExportExcel() {
        setExporting(true);
        try {
            const transactions = await getTransactions();
            exportToExcel(transactions, `spendwise_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    }

    async function handleExportCSV() {
        setExporting(true);
        try {
            const transactions = await getTransactions();
            exportToCSV(transactions, `spendwise_export_${new Date().toISOString().split('T')[0]}.csv`);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    }

    async function handleExportJSON() {
        setExporting(true);
        try {
            const [transactions, categories] = await Promise.all([
                getTransactions(),
                getCategories()
            ]);

            const exportData = {
                version: '1.0',
                exportedAt: new Date().toISOString(),
                transactions,
                categories
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `spendwise_backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    }

    async function handleClearData() {
        setClearing(true);
        try {
            await clearAllTransactions();
            setShowClearConfirm(false);
            setImportResult({ success: true, message: 'Tutte le transazioni sono state eliminate.' });
            onTransactionsImported?.();
        } catch {
            setImportResult({ success: false, message: 'Errore durante l\'eliminazione.' });
        } finally {
            setClearing(false);
        }
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }

    function updateGmailSettings(updates: Partial<GmailSyncSettings>) {
        const next = { ...gmailSettings, ...updates };
        setGmailSettings(next);
        saveGmailSyncSettings(next);
    }

    const runGmailSync = useCallback(async (silent: boolean = false) => {
        if (!gmailToken || !isGmailTokenValid(gmailToken)) {
            clearGmailToken();
            setGmailToken(null);
            if (!silent) {
                setGmailResult({ success: false, message: "Sessione Gmail scaduta. Riconnetti l'account." });
            }
            return;
        }

        setGmailSyncing(true);
        try {
            const result = await syncIsybankTransactionsFromGmail({
                accessToken: gmailToken.accessToken,
                senderEmail: gmailSettings.senderEmail,
                maxResults: gmailSettings.maxResults
            });

            if (result.imported > 0) {
                onTransactionsImported?.();
            }

            const syncedAt = new Date().toISOString();
            setLastGmailSyncAt(syncedAt);
            localStorage.setItem(LAST_GMAIL_SYNC_KEY, syncedAt);

            const message = result.errors.length > 0
                ? `Sync completata: ${result.imported} importate, ${result.skipped} saltate, ${result.errors.length} errori.`
                : `Sync completata: ${result.imported} importate, ${result.skipped} duplicate/saltate.`;

            setGmailResult({ success: result.errors.length === 0, message });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante la sincronizzazione Gmail';
            setGmailResult({ success: false, message });
        } finally {
            setGmailSyncing(false);
        }
    }, [gmailSettings.maxResults, gmailSettings.senderEmail, gmailToken, onTransactionsImported]);

    async function handleConnectGmail() {
        setGmailSyncing(true);
        try {
            const token = await requestGmailAccessToken(gmailSettings.googleClientId);
            setGmailToken(token);
            saveGmailToken(token);
            setGmailResult({ success: true, message: 'Gmail collegato con successo.' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Connessione Gmail fallita';
            setGmailResult({ success: false, message });
        } finally {
            setGmailSyncing(false);
        }
    }

    function handleDisconnectGmail() {
        clearGmailToken();
        setGmailToken(null);
        setGmailResult({ success: true, message: 'Account Gmail scollegato.' });
    }

    useEffect(() => {
        if (!gmailToken) return;
        if (isGmailTokenValid(gmailToken)) return;

        clearGmailToken();
        setGmailToken(null);
        setGmailResult({ success: false, message: "Sessione Gmail scaduta. Riconnetti l'account." });
    }, [gmailToken]);

    useEffect(() => {
        if (!gmailSettings.autoSync) return;
        if (!gmailToken || !isGmailTokenValid(gmailToken)) return;

        const intervalMs = Math.max(1, gmailSettings.pollingMinutes) * 60_000;
        const intervalId = window.setInterval(() => {
            void runGmailSync(true);
        }, intervalMs);

        return () => window.clearInterval(intervalId);
    }, [gmailSettings.autoSync, gmailSettings.pollingMinutes, gmailToken, runGmailSync]);

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Impostazioni</h1>
            </div>

            {/* Import Section */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        <Upload size={18} style={{ verticalAlign: 'middle', marginRight: 'var(--space-sm)' }} />
                        Importa da Isybank
                    </h3>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Importa le tue transazioni dal file Excel scaricato da Isybank.
                    Le transazioni duplicate verranno automaticamente saltate.
                </p>

                <div
                    className={`file-upload ${dragOver ? 'dragover' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                    />
                    <Upload size={40} style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }} />
                    <p style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {importing ? 'Importazione in corso...' : 'Trascina qui il file Excel o clicca per selezionare'}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 'var(--space-sm)' }}>
                        Supporta file .xlsx e .xls da Isybank
                    </p>
                </div>

                {importResult && (
                    <div style={{
                        marginTop: 'var(--space-lg)',
                        padding: 'var(--space-md)',
                        background: importResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                        borderRadius: 'var(--radius-md)',
                        color: importResult.success ? 'var(--success)' : 'var(--danger)'
                    }}>
                        {importResult.message}
                    </div>
                )}
            </div>

            {/* Gmail Auto Sync Section */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        <Mail size={18} style={{ verticalAlign: 'middle', marginRight: 'var(--space-sm)' }} />
                        Sync automatico da Gmail
                    </h3>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                    Importa automaticamente le email Isybank da <strong>{gmailSettings.senderEmail}</strong> e crea
                    transazioni in SpendWise (con deduplica automatica).
                </p>

                <div style={{ display: 'grid', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Google OAuth Client ID</span>
                        <input
                            type="text"
                            className="input"
                            placeholder="xxxxxxxx.apps.googleusercontent.com"
                            value={gmailSettings.googleClientId}
                            onChange={e => updateGmailSettings({ googleClientId: e.target.value })}
                        />
                    </label>

                    <label style={{ display: 'grid', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Mittente banca</span>
                        <input
                            type="email"
                            className="input"
                            value={gmailSettings.senderEmail}
                            onChange={e => updateGmailSettings({ senderEmail: e.target.value })}
                        />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                        <label style={{ display: 'grid', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Email da leggere</span>
                            <input
                                type="number"
                                className="input"
                                min={5}
                                max={100}
                                value={gmailSettings.maxResults}
                                onChange={e => updateGmailSettings({ maxResults: Number.parseInt(e.target.value || '25', 10) })}
                            />
                        </label>

                        <label style={{ display: 'grid', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Intervallo auto-sync (min)</span>
                            <input
                                type="number"
                                className="input"
                                min={1}
                                max={120}
                                value={gmailSettings.pollingMinutes}
                                onChange={e => updateGmailSettings({ pollingMinutes: Number.parseInt(e.target.value || '10', 10) })}
                            />
                        </label>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <input
                            type="checkbox"
                            checked={gmailSettings.autoSync}
                            onChange={e => updateGmailSettings({ autoSync: e.target.checked })}
                        />
                        <span>Abilita sincronizzazione automatica periodica</span>
                    </label>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleConnectGmail}
                        disabled={gmailSyncing}
                    >
                        <Mail size={16} />
                        {gmailToken && isGmailTokenValid(gmailToken) ? 'Ricollega Gmail' : 'Collega Gmail'}
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={() => void runGmailSync(false)}
                        disabled={gmailSyncing || !gmailToken || !isGmailTokenValid(gmailToken)}
                    >
                        <RefreshCcw size={16} />
                        {gmailSyncing ? 'Sincronizzazione...' : 'Sincronizza ora'}
                    </button>

                    <button
                        className="btn btn-secondary"
                        onClick={handleDisconnectGmail}
                        disabled={gmailSyncing || !gmailToken}
                    >
                        <Link2Off size={16} />
                        Scollega
                    </button>
                </div>

                <div style={{ marginTop: 'var(--space-md)', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Stato connessione: {gmailToken && isGmailTokenValid(gmailToken) ? 'attiva' : 'non attiva'}
                    {lastGmailSyncAt ? ` • Ultima sync: ${new Date(lastGmailSyncAt).toLocaleString('it-IT')}` : ''}
                </div>

                {gmailResult && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        background: gmailResult.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                        borderRadius: 'var(--radius-md)',
                        color: gmailResult.success ? 'var(--success)' : 'var(--danger)'
                    }}>
                        {gmailResult.message}
                    </div>
                )}
            </div>

            {/* Export Section */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        <Download size={18} style={{ verticalAlign: 'middle', marginRight: 'var(--space-sm)' }} />
                        Esporta dati
                    </h3>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Esporta le tue transazioni in diversi formati per backup o analisi.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportExcel}
                        disabled={exporting}
                    >
                        <FileSpreadsheet size={18} />
                        Esporta Excel
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportCSV}
                        disabled={exporting}
                    >
                        <FileSpreadsheet size={18} />
                        Esporta CSV
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExportJSON}
                        disabled={exporting}
                    >
                        <FileJson size={18} />
                        Backup completo (JSON)
                    </button>
                </div>
            </div>

            {/* Data Storage Info */}
            <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">
                        <Database size={18} style={{ verticalAlign: 'middle', marginRight: 'var(--space-sm)' }} />
                        Archiviazione dati
                    </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        background: 'var(--bg-glass)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <HardDrive size={24} style={{ color: 'var(--accent-primary)' }} />
                        <div>
                            <div style={{ fontWeight: 500 }}>Storage locale (IndexedDB)</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Tutti i dati sono memorizzati localmente sul tuo dispositivo
                            </div>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                        padding: 'var(--space-md)',
                        background: 'var(--bg-glass)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <Shield size={24} style={{ color: 'var(--success)' }} />
                        <div>
                            <div style={{ fontWeight: 500 }}>Privacy garantita</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                Nessun dato viene inviato a server esterni
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="card" style={{ borderColor: 'var(--danger)' }}>
                <div className="card-header">
                    <h3 className="card-title" style={{ color: 'var(--danger)' }}>
                        <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 'var(--space-sm)' }} />
                        Zona pericolosa
                    </h3>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>
                    Queste azioni sono irreversibili. Assicurati di aver fatto un backup prima di procedere.
                </p>

                {showClearConfirm ? (
                    <div style={{
                        padding: 'var(--space-lg)',
                        background: 'var(--danger-bg)',
                        borderRadius: 'var(--radius-md)'
                    }}>
                        <p style={{ color: 'var(--danger)', marginBottom: 'var(--space-md)', fontWeight: 500 }}>
                            Sei sicuro di voler eliminare TUTTE le transazioni? Questa azione non può essere annullata.
                        </p>
                        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
                            <button
                                className="btn btn-danger"
                                onClick={handleClearData}
                                disabled={clearing}
                            >
                                <Trash2 size={16} />
                                {clearing ? 'Eliminazione...' : 'Sì, elimina tutto'}
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowClearConfirm(false)}
                            >
                                Annulla
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        className="btn btn-danger"
                        onClick={() => setShowClearConfirm(true)}
                    >
                        <Trash2 size={16} />
                        Elimina tutte le transazioni
                    </button>
                )}
            </div>

            {/* Import Preview Modal */}
            {preview && (
                <ImportPreviewModal
                    preview={preview}
                    onConfirm={handleConfirmImport}
                    onCancel={() => { setPreview(null); setPendingFile(null); }}
                    importing={importing}
                />
            )}
        </>
    );
}
