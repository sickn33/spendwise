import { useCallback, useEffect, useRef, useState, memo } from 'react';
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
    cleanupLikelyGmailDuplicates,
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
    AlertTriangle,
    Mail,
    RefreshCcw,
    Link2Off
} from 'lucide-react';

const LAST_GMAIL_SYNC_KEY = 'spendwise-gmail-last-sync';

interface SettingsProps {
    onTransactionsImported?: () => void;
}

export const Settings = memo(function Settings({ onTransactionsImported }: SettingsProps) {
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
    const [gmailCleaning, setGmailCleaning] = useState(false);
    const [gmailResult, setGmailResult] = useState<{ success: boolean; message: string } | null>(null);
    // lastGmailSyncAt is only written to, never read in new UI (except for conditional that was removed or could be kept if wanted)
    // Actually I should keep it if I want to show last sync time.
    // In the refactored JSX I removed the "Ultima sync" text or I didn't verify if I kept it.
    // Let's check refactored JSX.
    // I see in my previous edit I removed line 471 "Ultima sync...".
    // So I can remove the state if unused.
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
            localStorage.setItem(LAST_GMAIL_SYNC_KEY, syncedAt);

            const message = result.errors.length > 0
                ? `Sync completata: ${result.imported} importate, ${result.updated} aggiornate, ${result.removed} rimosse, ${result.skipped} saltate, ${result.errors.length} errori.`
                : `Sync completata: ${result.imported} importate, ${result.updated} aggiornate, ${result.removed} rimosse, ${result.skipped} duplicate/saltate.`;

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

    async function handleCleanupGmailDuplicates() {
        setGmailCleaning(true);
        try {
            const result = await cleanupLikelyGmailDuplicates();
            if (result.removed > 0) {
                onTransactionsImported?.();
            }
            setGmailResult({
                success: true,
                message: `Pulizia completata: ${result.removed} duplicati rimossi su ${result.scanned} transazioni.`
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Errore durante la pulizia duplicati';
            setGmailResult({ success: false, message });
        } finally {
            setGmailCleaning(false);
        }
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
        <div className="space-y-xl max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-md border-b border-border">
                <div>
                    <h1 className="text-xl font-bold tracking-tight">IMPOSTAZIONI_SISTEMA</h1>
                    <p className="text-xs font-mono text-muted uppercase tracking-wider mt-1">
                        CONTROL_PANEL_V1.0
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
                {/* Left Column */}
                <div className="space-y-lg">
                    
                    {/* Import Section */}
                    <div className="space-y-md">
                        <h3 className="text-xs font-mono uppercase text-muted border-l-2 border-primary pl-2">
                            IMPORTAZIONE_DATI
                        </h3>
                        
                        <div 
                            className={`bg-paper structural-border p-md border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                        >
                            <label className="flex flex-col items-center justify-center gap-sm cursor-pointer py-lg group">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                />
                                <div className="p-md rounded-full bg-concrete/50 group-hover:bg-primary/10 transition-colors">
                                    <Upload size={24} className="text-muted group-hover:text-primary transition-colors" />
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-sm font-bold uppercase">IMPORTA_DA_ISYBANK_XLS</p>
                                    <p className="text-xs text-muted mt-1 uppercase tracking-wider">
                                        {importing ? 'ELABORAZIONE...' : 'DRAG_AND_DROP_OR_CLICK'}
                                    </p>
                                </div>
                            </label>
                            {importResult && (
                                <div className={`mt-md p-sm text-xs font-mono border-l-2 ${importResult.success ? 'border-success text-success bg-success/5' : 'border-danger text-danger bg-danger/5'}`}>
                                    {importResult.message}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gmail Sync */}
                    <div className="space-y-md">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-mono uppercase text-muted border-l-2 border-primary pl-2">
                                SINCRONIZZAZIONE_GMAIL
                            </h3>
                            <div className={`px-2 py-0.5 rounded-none text-tiny font-mono uppercase border ${gmailToken && isGmailTokenValid(gmailToken) ? 'border-success text-success bg-success/10' : 'border-muted text-muted'}`}>
                                {gmailToken && isGmailTokenValid(gmailToken) ? 'CONNECTED' : 'OFFLINE'}
                            </div>
                        </div>

                        <div className="bg-paper structural-border p-md space-y-md">
                            <div className="grid gap-sm">
                                <label className="space-y-xs">
                                    <span className="text-tiny font-mono uppercase text-muted">CLIENT_ID_GMAIL</span>
                                    <input
                                        type="text"
                                        className="w-full bg-concrete/20 border-b border-border focus:border-ink py-xs font-mono text-xs focus:outline-none"
                                        placeholder="xxxxxxxx.apps.googleusercontent.com"
                                        value={gmailSettings.googleClientId}
                                        onChange={e => updateGmailSettings({ googleClientId: e.target.value })}
                                    />
                                </label>
                                
                                <label className="space-y-xs">
                                    <span className="text-tiny font-mono uppercase text-muted">MITTENTE_BANCA</span>
                                    <input
                                        type="email"
                                        className="w-full bg-concrete/20 border-b border-border focus:border-ink py-xs font-mono text-xs focus:outline-none"
                                        value={gmailSettings.senderEmail}
                                        onChange={e => updateGmailSettings({ senderEmail: e.target.value })}
                                    />
                                </label>

                                <div className="grid grid-cols-2 gap-md">
                                    <label className="space-y-xs">
                                        <span className="text-tiny font-mono uppercase text-muted">MAX_RESULTS</span>
                                        <input
                                            type="number"
                                            className="w-full bg-concrete/20 border-b border-border focus:border-ink py-xs font-mono text-xs focus:outline-none"
                                            value={gmailSettings.maxResults}
                                            onChange={e => updateGmailSettings({ maxResults: Number.parseInt(e.target.value || '25', 10) })}
                                        />
                                    </label>
                                    <label className="space-y-xs">
                                        <span className="text-tiny font-mono uppercase text-muted">POLLING (MIN)</span>
                                        <input
                                            type="number"
                                            className="w-full bg-concrete/20 border-b border-border focus:border-ink py-xs font-mono text-xs focus:outline-none"
                                            value={gmailSettings.pollingMinutes}
                                            onChange={e => updateGmailSettings({ pollingMinutes: Number.parseInt(e.target.value || '10', 10) })}
                                        />
                                    </label>
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-sm cursor-pointer group">
                                <div className={`w-4 h-4 border transition-colors ${gmailSettings.autoSync ? 'bg-primary border-primary' : 'border-muted group-hover:border-ink'}`}>
                                    {gmailSettings.autoSync && <div className="w-full h-full flex items-center justify-center text-white text-[10px]">✓</div>}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={gmailSettings.autoSync}
                                    onChange={e => updateGmailSettings({ autoSync: e.target.checked })}
                                />
                                <span className="text-xs font-mono uppercase text-muted group-hover:text-ink transition-colors">AUTO_SYNC_ENABLED</span>
                            </label>

                            <div className="grid grid-cols-2 gap-sm pt-sm border-t border-border">
                                <button
                                    className="btn btn-secondary text-xs uppercase"
                                    onClick={handleConnectGmail}
                                    disabled={gmailSyncing || gmailCleaning}
                                >
                                    <Mail size={14} className="mr-xs" />
                                    {gmailToken && isGmailTokenValid(gmailToken) ? 'RICOLLEGA' : 'COLLEGA_GMAIL'}
                                </button>
                                <button
                                    className="btn btn-secondary text-xs uppercase"
                                    onClick={() => void runGmailSync(false)}
                                    disabled={!gmailToken || !isGmailTokenValid(gmailToken)}
                                >
                                    <RefreshCcw size={14} className={`mr-xs ${gmailSyncing ? 'animate-spin' : ''}`} />
                                    {gmailSyncing ? 'SYNCING...' : 'SYNC_NOW'}
                                </button>
                                <button
                                    className="btn btn-ghost text-xs uppercase text-muted hover:text-ink"
                                    onClick={() => void handleCleanupGmailDuplicates()}
                                    disabled={gmailSyncing || gmailCleaning}
                                >
                                    <Trash2 size={14} className="mr-xs" />
                                    CLEAN_DUPLICATES
                                </button>
                                <button
                                    className="btn btn-ghost text-xs uppercase text-danger hover:bg-danger/5"
                                    onClick={handleDisconnectGmail}
                                    disabled={!gmailToken}
                                >
                                    <Link2Off size={14} className="mr-xs" />
                                    DISCONNECT
                                </button>
                            </div>
                            
                            {gmailResult && (
                                <div className={`p-sm text-xs font-mono border-l-2 ${gmailResult.success ? 'border-success text-success bg-success/5' : 'border-danger text-danger bg-danger/5'}`}>
                                    {gmailResult.message}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-lg">
                    {/* Export */}
                    <div className="space-y-md">
                        <h3 className="text-xs font-mono uppercase text-muted border-l-2 border-primary pl-2">
                            ESPORTAZIONE_DATI
                        </h3>
                        <div className="bg-paper structural-border p-md grid grid-cols-1 gap-sm">
                            <button
                                className="flex items-center justify-between p-sm border border-border hover:border-ink hover:bg-concrete/20 transition-all group"
                                onClick={handleExportExcel}
                                disabled={exporting}
                            >
                                <div className="flex items-center gap-sm">
                                    <FileSpreadsheet size={16} className="text-muted group-hover:text-ink" />
                                    <span className="text-xs font-mono uppercase">EXPORT_EXCEL</span>
                                </div>
                                <Download size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button
                                className="flex items-center justify-between p-sm border border-border hover:border-ink hover:bg-concrete/20 transition-all group"
                                onClick={handleExportCSV}
                                disabled={exporting}
                            >
                                <div className="flex items-center gap-sm">
                                    <FileSpreadsheet size={16} className="text-muted group-hover:text-ink" />
                                    <span className="text-xs font-mono uppercase">EXPORT_CSV</span>
                                </div>
                                <Download size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                            <button
                                className="flex items-center justify-between p-sm border border-border hover:border-ink hover:bg-concrete/20 transition-all group"
                                onClick={handleExportJSON}
                                disabled={exporting}
                            >
                                <div className="flex items-center gap-sm">
                                    <FileJson size={16} className="text-muted group-hover:text-ink" />
                                    <span className="text-xs font-mono uppercase">BACKUP_JSON</span>
                                </div>
                                <Download size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                        </div>
                    </div>

                    {/* Storage Info */}
                    <div className="space-y-md">
                        <h3 className="text-xs font-mono uppercase text-muted border-l-2 border-ink pl-2">
                            STORAGE_&_PRIVACY
                        </h3>
                        <div className="bg-paper structural-border p-md space-y-sm">
                            <div className="flex items-start gap-md">
                                <Database size={18} className="text-muted mt-0.5" />
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider mb-1">LOCAL_INDEXEDDB</div>
                                    <div className="text-xs text-muted leading-relaxed">
                                        I dati sono salvati esclusivamente nel browser del tuo dispositivo.
                                    </div>
                                </div>
                            </div>
                            <div className="h-px bg-border my-sm" />
                            <div className="flex items-start gap-md">
                                <Shield size={18} className="text-success mt-0.5" />
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-wider mb-1">OFFLINE_FIRST</div>
                                    <div className="text-xs text-muted leading-relaxed">
                                        Nessuna trasmissione di dati a server esterni. Privacy garantita by design.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="space-y-md">
                        <h3 className="text-xs font-mono uppercase text-danger border-l-2 border-danger pl-2">
                            ZONA_PERICOLOSA
                        </h3>
                        <div className="bg-paper structural-border border-danger/50 p-md">
                            {showClearConfirm ? (
                                <div className="space-y-md animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-sm text-danger">
                                        <AlertTriangle size={18} />
                                        <span className="text-xs font-bold uppercase">CONFERMA_ELIMINAZIONE</span>
                                    </div>
                                    <p className="text-xs text-muted">
                                        L'azione è irreversibile. Tutti i dati verranno rimossi permanentemente.
                                    </p>
                                    <div className="flex gap-sm">
                                        <button
                                            className="btn bg-danger text-white text-xs uppercase flex-1 hover:bg-danger/90 border-transparent"
                                            onClick={handleClearData}
                                            disabled={clearing}
                                        >
                                            {clearing ? 'ELIMINAZIONE...' : 'CONFERMA_RESET'}
                                        </button>
                                        <button
                                            className="btn btn-secondary text-xs uppercase flex-1"
                                            onClick={() => setShowClearConfirm(false)}
                                        >
                                            ANNULLA
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="w-full flex items-center justify-between p-sm border border-danger/30 text-danger hover:bg-danger/5 transition-colors group"
                                    onClick={() => setShowClearConfirm(true)}
                                >
                                    <div className="flex items-center gap-sm">
                                        <Trash2 size={16} />
                                        <span className="text-xs font-mono uppercase font-bold">RESET_DATABASE</span>
                                    </div>
                                    <AlertTriangle size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
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
        </div>
    );
});
