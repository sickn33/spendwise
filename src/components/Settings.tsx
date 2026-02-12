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
import { useLocalBackup } from '../hooks/useLocalBackup';
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
    Link2Off,
    HardDrive
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
    const { 
        fileHandle, 
        permissionStatus, 
        connectBackup, 
        disconnectBackup, 
        requestPermission,
        error: backupError
    } = useLocalBackup();

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
        <div className="max-w-4xl mx-auto space-y-2xl">
            {/* Page Header - Industrial Style */}
            <div className="page-header border-b pb-xl mb-xl">
                <div>
                    <h1 className="font-display">IMPOSTAZIONI_SISTEMA</h1>
                    <div className="flex items-center gap-sm opacity-50 font-mono text-[10px] uppercase tracking-[0.2em] mt-2">
                        <span>CONTROL_PANEL</span>
                        <div className="w-8 h-px bg-border-structural"></div>
                        <span>v1.0.0_STABLE</span>
                    </div>
                </div>
            </div>

            <div className="grid-2">
                {/* Left Column: Import & Gmail */}
                <div className="space-y-xl">
                    
                    {/* Import Section - Technical Spec Box */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">IMPORTAZIONE_DATI</h3>
                            <div className="text-[10px] font-mono opacity-40">MODULE_01</div>
                        </div>
                        
                        <div 
                            className={`p-xl border-2 border-dashed border-border-structural bg-concrete/10 transition-all ${dragOver ? 'border-accent-signal bg-accent-signal/5' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                        >
                            <label className="flex flex-col items-center justify-center gap-md cursor-pointer py-xl group">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                />
                                <div className="w-12 h-12 flex items-center justify-center bg-concrete group-hover:bg-accent-signal group-hover:text-white transition-all">
                                    <Upload size={20} />
                                </div>
                                <div className="text-center">
                                    <p className="font-mono text-xs font-bold uppercase tracking-wider">IMPORTA_XLS_ISYBANK</p>
                                    <p className="font-mono text-[9px] text-muted mt-2 uppercase tracking-[0.1em]">
                                        {importing ? 'STATUS: PROCESSING...' : 'STATUS: READY_FOR_INPUT'}
                                    </p>
                                </div>
                            </label>
                            {importResult && (
                                <div className={`mt-lg p-md font-mono text-[10px] border-l-4 ${importResult.success ? 'border-success bg-success/5 text-success' : 'border-danger bg-danger/5 text-danger'}`}>
                                    {importResult.message.toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Gmail Sync - Industrial Specs */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">GMAIL_SYNCHRONIZER</h3>
                            <div className={`px-2 py-0.5 font-mono text-[9px] uppercase border ${gmailToken && isGmailTokenValid(gmailToken) ? 'border-success text-success bg-success/5' : 'border-border-structural text-muted'}`}>
                                {gmailToken && isGmailTokenValid(gmailToken) ? 'STATUS: ONLINE' : 'STATUS: OFFLINE'}
                            </div>
                        </div>

                        <div className="space-y-lg">
                            <div className="grid gap-md">
                                <div className="input-group">
                                    <label htmlFor="gmail-client-id" className="input-label">CLIENT_ID_GMAIL</label>
                                    <input
                                        id="gmail-client-id"
                                        type="text"
                                        className="input font-mono text-xs"
                                        placeholder="CLIENT_ID.apps.googleusercontent.com"
                                        value={gmailSettings.googleClientId}
                                        onChange={e => updateGmailSettings({ googleClientId: e.target.value })}
                                    />
                                </div>
                                
                                <div className="input-group">
                                    <label htmlFor="gmail-sender-email" className="input-label">BANCA_SENDER_EMAIL</label>
                                    <input
                                        id="gmail-sender-email"
                                        type="email"
                                        className="input font-mono text-xs"
                                        value={gmailSettings.senderEmail}
                                        onChange={e => updateGmailSettings({ senderEmail: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-md">
                                    <div className="input-group">
                                        <label htmlFor="gmail-max-results" className="input-label">MAX_RECORDS</label>
                                        <input
                                            id="gmail-max-results"
                                            type="number"
                                            className="input font-mono text-xs"
                                            value={gmailSettings.maxResults}
                                            onChange={e => updateGmailSettings({ maxResults: Number.parseInt(e.target.value || '25', 10) })}
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label htmlFor="gmail-polling" className="input-label">POLLING_LATENCY_(M)</label>
                                        <input
                                            id="gmail-polling"
                                            type="number"
                                            className="input font-mono text-xs"
                                            value={gmailSettings.pollingMinutes}
                                            onChange={e => updateGmailSettings({ pollingMinutes: Number.parseInt(e.target.value || '10', 10) })}
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-md cursor-pointer group py-sm border-t border-b border-border-structural/30">
                                <div className={`w-4 h-4 border border-text-ink flex items-center justify-center transition-all ${gmailSettings.autoSync ? 'bg-text-ink' : 'bg-transparent'}`}>
                                    {gmailSettings.autoSync && <div className="w-2 h-2 bg-paper"></div>}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={gmailSettings.autoSync}
                                    onChange={e => updateGmailSettings({ autoSync: e.target.checked })}
                                />
                                <span className="font-mono text-[10px] uppercase tracking-wider text-muted group-hover:text-ink">ENABLE_AUTO_SYNC_DAEMON</span>
                            </label>

                            <div className="grid grid-cols-2 gap-sm">
                                <button
                                    className="btn btn-secondary text-[10px]"
                                    onClick={handleConnectGmail}
                                    disabled={gmailSyncing || gmailCleaning}
                                >
                                    <Mail size={14} />
                                    {gmailToken && isGmailTokenValid(gmailToken) ? 'RECONNECT' : 'AUTHORIZE_GMAIL'}
                                </button>
                                <button
                                    className="btn btn-primary text-[10px]"
                                    onClick={() => void runGmailSync(false)}
                                    disabled={!gmailToken || !isGmailTokenValid(gmailToken)}
                                >
                                    <RefreshCcw size={14} className={gmailSyncing ? 'animate-spin' : ''} />
                                    {gmailSyncing ? 'SYNCING...' : 'RUN_MANUAL_SYNC'}
                                </button>
                                <button
                                    className="btn btn-ghost text-[10px] text-danger hover:bg-danger/5"
                                    onClick={handleDisconnectGmail}
                                    disabled={!gmailToken}
                                >
                                    <Link2Off size={14} />
                                    TERMINATE_SESSION
                                </button>
                                <button
                                    className="btn btn-ghost text-[10px] col-span-2 border-border-structural"
                                    onClick={() => void handleCleanupGmailDuplicates()}
                                    disabled={gmailSyncing || gmailCleaning}
                                >
                                    <Trash2 size={14} />
                                    PURGE_DUPLICATE_RECORDS
                                </button>
                            </div>
                            
                            {gmailResult && (
                                <div className={`p-md font-mono text-[10px] border-l-4 ${gmailResult.success ? 'border-success bg-success/5 text-success' : 'border-danger bg-danger/5 text-danger'}`}>
                                    {gmailResult.message.toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Export & Storage */}
                <div className="space-y-xl">
                    {/* Export Section */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">DATA_EXTRACTION</h3>
                            <div className="text-[10px] font-mono opacity-40">EXTRACT_v1</div>
                        </div>
                        <div className="space-y-sm">
                            <button
                                className="w-full flex items-center justify-between p-md border border-border-structural hover:border-text-ink hover:bg-concrete/30 transition-all group"
                                onClick={handleExportExcel}
                                disabled={exporting}
                            >
                                <div className="flex items-center gap-md">
                                    <FileSpreadsheet size={16} className="text-muted" />
                                    <span className="font-mono text-xs uppercase font-bold">EXPORT_SPEC_XLSX</span>
                                </div>
                                <Download size={14} className="opacity-0 group-hover:opacity-100" />
                            </button>
                            <button
                                className="w-full flex items-center justify-between p-md border border-border-structural hover:border-text-ink hover:bg-concrete/30 transition-all group"
                                onClick={handleExportCSV}
                                disabled={exporting}
                            >
                                <div className="flex items-center gap-md">
                                    <FileSpreadsheet size={16} className="text-muted" />
                                    <span className="font-mono text-xs uppercase font-bold">EXPORT_LEDGER_CSV</span>
                                </div>
                                <Download size={14} className="opacity-0 group-hover:opacity-100" />
                            </button>
                            <button
                                className="w-full flex items-center justify-between p-md border border-border-structural hover:border-text-ink hover:bg-concrete/30 transition-all group"
                                onClick={handleExportJSON}
                                disabled={exporting}
                            >
                                <div className="flex items-center gap-md">
                                    <FileJson size={16} className="text-muted" />
                                    <span className="font-mono text-xs uppercase font-bold">SYSTEM_BACKUP_JSON</span>
                                </div>
                                <Download size={14} className="opacity-0 group-hover:opacity-100" />
                            </button>
                        </div>
                    </div>

                    {/* Automatic Backup Protocol - Industrial Style */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">AUTOMATIC_BACKUP_PROTOCOL</h3>
                            <div className={`px-2 py-0.5 font-mono text-[9px] uppercase border ${fileHandle ? (permissionStatus === 'granted' ? 'border-success text-success bg-success/5' : 'border-warning text-warning bg-warning/5') : 'border-border-structural text-muted'}`}>
                                {fileHandle ? (permissionStatus === 'granted' ? 'STATUS: ACTIVE' : 'STATUS: PERMISSION_REQUIRED') : 'STATUS: INACTIVE'}
                            </div>
                        </div>
                        
                        <div className="space-y-lg">
                            <div className="flex items-start gap-lg p-md border border-border-structural bg-concrete/5">
                                <div className={`p-sm flex-shrink-0 ${fileHandle ? 'bg-concrete' : 'bg-concrete/30 opacity-40'}`}>
                                    <HardDrive size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider mb-1">LOCAL_FILE_POINTER</div>
                                    <div className="font-mono text-[9px] text-muted truncate uppercase tracking-tight">
                                        {fileHandle ? `TARGET: ${fileHandle.name}` : 'TARGET: NOT_CONFIGURED'}
                                    </div>
                                </div>
                            </div>

                            {backupError && (
                                <div className="p-sm bg-danger/5 border-l-2 border-danger font-mono text-[9px] text-danger uppercase">
                                    {backupError}
                                </div>
                            )}

                            <div className="grid gap-sm">
                                {!fileHandle ? (
                                    <button
                                        className="btn btn-primary w-full text-[10px] font-bold uppercase tracking-widest"
                                        onClick={connectBackup}
                                    >
                                        <Database size={14} />
                                        INITIALIZE_BACKUP_FILE
                                    </button>
                                ) : (
                                    <>
                                        {permissionStatus !== 'granted' && (
                                            <button
                                                className="btn btn-primary w-full text-[10px] font-bold uppercase tracking-widest bg-warning hover:bg-warning/80 border-none"
                                                onClick={requestPermission}
                                            >
                                                <Shield size={14} />
                                                RESTORE_ACCESS_PERMISSION
                                            </button>
                                        )}
                                        <div className="grid grid-cols-2 gap-sm">
                                            <button
                                                className="btn btn-secondary text-[10px]"
                                                onClick={connectBackup}
                                            >
                                                <RefreshCcw size={14} />
                                                CHANGE_FILE
                                            </button>
                                            <button
                                                className="btn btn-ghost text-[10px] border-danger/30 text-danger hover:bg-danger/10"
                                                onClick={disconnectBackup}
                                            >
                                                <Link2Off size={14} />
                                                TERMINATE_LINK
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <p className="font-mono text-[8px] text-muted uppercase leading-relaxed text-center opacity-60">
                                This configuration enables periodic background sync to local filesystem. User activation required for session restoration.
                            </p>
                        </div>
                    </div>

                    {/* Storage Info */}
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">MEMORY_&_PROTOCOLS</h3>
                        </div>
                        <div className="space-y-lg">
                            <div className="flex items-start gap-lg">
                                <div className="p-sm bg-concrete flex-shrink-0">
                                    <Database size={18} />
                                </div>
                                <div>
                                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider mb-1">LOCAL_INDEXEDDB_LEDGER</div>
                                    <div className="font-sans text-xs text-muted leading-relaxed uppercase">
                                        Data Persistance: Local Environment Only. No Cloud Transmission.
                                    </div>
                                </div>
                            </div>
                            <div className="h-px bg-border-structural" />
                            <div className="flex items-start gap-lg">
                                <div className="p-sm bg-success/10 text-success flex-shrink-0">
                                    <Shield size={18} />
                                </div>
                                <div>
                                    <div className="font-mono text-[10px] font-bold uppercase tracking-wider mb-1">SECURITY_PROTOCOL_P1</div>
                                    <div className="font-sans text-xs text-muted leading-relaxed uppercase">
                                        Privacy Guarantee: Offline-First Architecture. Zero External Telemetry.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="card border-danger/30 bg-danger/[0.02]">
                        <div className="card-header border-danger/50 mb-xl">
                            <h3 className="card-title text-danger">SYSTEM_OVERRIDE</h3>
                            <AlertTriangle size={14} className="text-danger opacity-50" />
                        </div>
                        <div>
                            {showClearConfirm ? (
                                <div className="space-y-lg animate-in fade-in zoom-in-95 duration-200">
                                    <div className="font-mono text-[10px] text-danger font-bold uppercase tracking-widest text-center">
                                        !! WARNING: DATA_DESTRUCTION_PENDING !!
                                    </div>
                                    <p className="font-mono text-[9px] text-muted text-center uppercase">
                                        Irreversible Action. This will clear the entire IndexedDB instance.
                                    </p>
                                    <div className="flex gap-md">
                                        <button
                                            className="btn bg-danger text-white border-none flex-1 font-bold text-[10px]"
                                            onClick={handleClearData}
                                            disabled={clearing}
                                        >
                                            {clearing ? 'EXECUTING...' : 'CONFIRM_DESTRUCTION'}
                                        </button>
                                        <button
                                            className="btn btn-secondary flex-1 text-[10px]"
                                            onClick={() => setShowClearConfirm(false)}
                                        >
                                            ABORT_MISSION
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="w-full flex items-center justify-between p-md border border-danger/30 text-danger hover:bg-danger/10 transition-colors group"
                                    onClick={() => setShowClearConfirm(true)}
                                >
                                    <div className="flex items-center gap-md">
                                        <Trash2 size={16} />
                                        <span className="font-mono text-xs uppercase font-bold">RESET_SYSTEM_DATABASE</span>
                                    </div>
                                    <Shield size={14} className="opacity-0 group-hover:opacity-100" />
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
