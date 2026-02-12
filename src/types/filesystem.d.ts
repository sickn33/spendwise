/**
 * File System Access API type definitions.
 * Source: https://github.com/microsoft/TypeScript-DOM-lib-generator/issues/1004
 */

interface FileSystemHandle {
  readonly kind: 'file' | 'directory'
  readonly name: string
  isSameEntry(other: FileSystemHandle): Promise<boolean>
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
}

interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string | FileSystemWriteChunkType): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

type FileSystemWriteChunkType =
    | { type: 'write'; position?: number; data: BufferSource | Blob | string }
    | { type: 'seek'; position: number }
    | { type: 'truncate'; size: number };

interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: 'file';
    getFile(): Promise<File>;
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
}

interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
