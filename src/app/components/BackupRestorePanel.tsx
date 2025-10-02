import { format } from 'date-fns';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { exportBackupArchive, restoreBackupArchive } from '../db/backup';
import { useSettings } from '../state/SettingsContext';

const BACKUP_FILENAME_PREFIX = 'shift-recorder-backup';
const LOG_FILENAME = 'shift-recorder-backup-log.txt';

function isBackupSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (typeof Blob === 'undefined' || typeof File === 'undefined') {
    return false;
  }
  return (
    typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
  );
}

export default function BackupRestorePanel() {
  const { reloadSettings } = useSettings();
  const [logs, setLogs] = useState<string[]>([]);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [settingsOnly, setSettingsOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supported = useMemo(isBackupSupported, []);

  const appendLogs = useCallback((entries: string[]) => {
    if (entries.length === 0) {
      return;
    }
    setLogs((previous) => [...previous, ...entries]);
  }, []);

  useEffect(() => {
    return () => {
      setLogs([]);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
  }, []);

  const handleExport = async () => {
    if (!supported) {
      setErrorMessage('Backup is not supported in this browser.');
      return;
    }
    setIsExporting(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      const now = new Date();
      const { blob, logs: exportLogs } = await exportBackupArchive(now, {
        settingsOnly,
      });
      appendLogs(exportLogs);
      const timestamp = format(now, 'yyyyMMdd-HHmmss');
      const filename = `${BACKUP_FILENAME_PREFIX}-${timestamp}.tar.gz`;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setInfoMessage(
          settingsOnly
            ? `Settings-only backup saved as ${filename}.`
            : `Backup saved as ${filename}.`
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to export backup.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileError(null);
    setInfoMessage(null);
    setErrorMessage(null);
  };

  const handleRestore = async (event: FormEvent) => {
    event.preventDefault();
    if (!supported) {
      setErrorMessage('Backup restore is not supported in this browser.');
      return;
    }
    if (!selectedFile) {
      setFileError('Select a .tar.gz backup archive to restore.');
      return;
    }

    setIsRestoring(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const result = await restoreBackupArchive(selectedFile, new Date());
      appendLogs(result.logs);
      await reloadSettings();
      setInfoMessage('Backup restored successfully.');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to restore backup.'
      );
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadLog = async () => {
    if (logs.length === 0) {
      return;
    }
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = LOG_FILENAME;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6 text-sm">
      {!supported && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            Backup and restore require browser support for File and Blob APIs.
            Try updating your browser.
          </p>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Download backup
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Generates a tar.gz archive containing settings, shifts, and
          notification schedules. Keep the app open until the download
          finishes.
        </p>
        <label className="flex items-start gap-3 text-sm text-neutral-700 dark:text-neutral-200">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary dark:border-midnight-600"
            checked={settingsOnly}
            onChange={(event) => setSettingsOnly(event.target.checked)}
          />
          <span>
            <span className="font-medium">Backup settings only</span>
            <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400">
              When enabled, the archive excludes shifts but keeps your settings and
              notification schedules.
            </span>
          </span>
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting || !supported}
          className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? 'Preparing…' : 'Download backup'}
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Restore from backup
        </h3>
        <form className="space-y-3" onSubmit={handleRestore}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".tar.gz"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isRestoring || !supported}
              className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-midnight-700 dark:text-neutral-200 dark:hover:bg-midnight-800"
            >
              {selectedFile ? 'Choose another file' : 'Select backup file'}
            </button>
            {selectedFile && (
              <span
                className="truncate text-xs text-neutral-500 dark:text-neutral-300"
                title={selectedFile.name}
              >
                {selectedFile.name}
              </span>
            )}
            <button
              type="submit"
              disabled={isRestoring || !supported}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRestoring ? 'Restoring…' : 'Restore backup'}
            </button>
          </div>
          {fileError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              {fileError}
            </p>
          )}
        </form>
      </section>

      {(infoMessage || errorMessage) && (
        <div className="space-y-2">
          {infoMessage && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {infoMessage}
            </p>
          )}
          {errorMessage && (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              {errorMessage}
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          Logs
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">
          Recent backup activity is captured below. Download the log for
          long-term storage or troubleshooting.
        </p>
        <textarea
          readOnly
          value={logs.join('\n')}
          placeholder="No log entries yet."
          className="h-40 w-full resize-none rounded-lg border border-neutral-200 bg-neutral-100 p-3 font-mono text-xs text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-midnight-700 dark:bg-midnight-900 dark:text-neutral-200"
        />
        <button
          type="button"
          onClick={handleDownloadLog}
          disabled={logs.length === 0}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-midnight-700 dark:text-neutral-200 dark:hover:bg-midnight-800"
        >
          Download log
        </button>
      </section>
    </div>
  );
}
