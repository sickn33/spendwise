import { useState, useEffect, useCallback } from 'react';
import { getFileHandle, saveFileHandle, deleteFileHandle } from '../db/database';

export function useLocalBackup() {
    const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load handle on mount
    useEffect(() => {
        async function loadHandle() {
            try {
                const handle = await getFileHandle();
                if (handle) {
                    setFileHandle(handle);
                    // Check initial permission
                    const status = await handle.queryPermission({ mode: 'readwrite' });
                    setPermissionStatus(status);
                }
            } catch (err) {
                console.error('Error loading backup handle:', err);
                setError('Failed to load backup configuration');
            } finally {
                setLoading(false);
            }
        }
        loadHandle();
    }, []);

    const connectBackup = useCallback(async () => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `spendwise_backup_${new Date().toISOString().split('T')[0]}.json`,
                types: [{
                    description: 'JSON Backup File',
                    accept: { 'application/json': ['.json'] },
                }],
            });
            await saveFileHandle(handle);
            setFileHandle(handle);
            setPermissionStatus('granted');
            setError(null);
            return handle;
        } catch (err) {
            if ((err as Error).name === 'AbortError') return null;
            console.error('Error connecting backup:', err);
            setError('Could not connect to the selected file');
            throw err;
        }
    }, []);

    const disconnectBackup = useCallback(async () => {
        await deleteFileHandle();
        setFileHandle(null);
        setPermissionStatus('prompt');
        setError(null);
    }, []);

    const requestPermission = useCallback(async () => {
        if (!fileHandle) return false;
        try {
            const status = await fileHandle.requestPermission({ mode: 'readwrite' });
            setPermissionStatus(status);
            return status === 'granted';
        } catch (err) {
            console.error('Error requesting permission:', err);
            setError('Permission request failed');
            return false;
        }
    }, [fileHandle]);

    const saveToBackup = useCallback(async (data: unknown) => {
        if (!fileHandle || permissionStatus !== 'granted') return;

        try {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            setError(null);
        } catch (err) {
            console.error('Error saving to backup:', err);
            // If it failed because of permission, update state
            if ((err as Error).name === 'NotAllowedError') {
                setPermissionStatus('prompt');
            }
            setError('Failed to save data to local backup');
        }
    }, [fileHandle, permissionStatus]);

    return {
        fileHandle,
        permissionStatus,
        loading,
        error,
        connectBackup,
        disconnectBackup,
        requestPermission,
        saveToBackup
    };
}
