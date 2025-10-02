import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAllShifts, importShifts, type ShiftImportResult } from '../db/repo';
import {
  encodeCsvCell,
  parseShiftsCsv,
  shiftsToCsv,
  type ShiftCsvParseError,
  type ShiftCsvImportRow
} from '../logic/csv';
import templateCsvUrl from '../assets/shift-import-template.csv?url';
import { useSettings } from '../state/SettingsContext';

const EXPORT_FILENAME = 'shift-export';
const IMPORT_LOG_FILENAME = 'shift-import-log.csv';

type ImportRowStatus = ShiftCsvImportRow & {
  status: 'success' | 'duplicate' | 'overlap' | 'failed';
  message?: string;
};

type ImportReviewState = {
  rows: ImportRowStatus[];
  summary: {
    total: number;
    success: number;
    duplicate: number;
    overlap: number;
    failed: number;
  };
  logUrl: string;
};

const STATUS_COPY: Record<ImportRowStatus['status'], { label: string; className: string }> = {
  success: {
    label: 'Imported',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  },
  duplicate: {
    label: 'Duplicate',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
  },
  overlap: {
    label: 'Overlapping',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
  },
  failed: {
    label: 'Failed',
    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
  }
};

function buildLogContent(rows: ImportRowStatus[], dataErrors: ShiftCsvParseError[]): string {
  const header = 'line,date,start,finish,note,status,message';
  const dataLines = rows.map((row) => {
    const message = row.message ?? '';
    return [
      encodeCsvCell(row.line.toString()),
      encodeCsvCell(row.date),
      encodeCsvCell(row.start),
      encodeCsvCell(row.finish),
      encodeCsvCell(row.note),
      encodeCsvCell(STATUS_COPY[row.status].label),
      encodeCsvCell(message)
    ].join(',');
  });

  const errorLines = dataErrors
    .filter((error) => !rows.some((row) => row.line === error.line))
    .map((error) =>
      [
        encodeCsvCell(error.line.toString()),
        '',
        '',
        '',
        '',
        encodeCsvCell('Failed'),
        encodeCsvCell(error.message)
      ].join(',')
    );

  return [header, ...dataLines, ...errorLines].join('\n');
}

export default function ImportExportPanel() {
  const { settings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [review, setReview] = useState<ImportReviewState | null>(null);
  const [dataErrors, setDataErrors] = useState<ShiftCsvParseError[]>([]);
  const queryClient = useQueryClient();

  const templateHref = templateCsvUrl;

  const resetReview = useCallback(() => {
    setReview((previous) => {
      if (previous?.logUrl) {
        URL.revokeObjectURL(previous.logUrl);
      }
      return null;
    });
    setDataErrors([]);
  }, []);

  useEffect(() => {
    return () => {
      if (review?.logUrl) {
        URL.revokeObjectURL(review.logUrl);
      }
    };
  }, [review]);

  const handleExport = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const shifts = await getAllShifts();
      if (shifts.length === 0) {
        setInfoMessage('No shifts available to export.');
        return;
      }

      const csvContent = shiftsToCsv(shifts);
      const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
      const fileName = `${EXPORT_FILENAME}-${timestamp}.csv`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setInfoMessage(`Exported ${shifts.length} shift${shifts.length === 1 ? '' : 's'} to ${fileName}.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to export shifts.');
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerFilePicker = () => {
    if (isProcessing) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !settings) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const text = await file.text();
      const { entries, errors, rows } = parseShiftsCsv(text);
      const headerErrors = errors.filter((error) => error.line === 1);

      if (entries.length === 0 && rows.length === 0 && headerErrors.length > 0) {
        setErrorMessage(headerErrors[0].message);
        resetReview();
        return;
      }

      const importResults: ShiftImportResult[] = await importShifts(entries, settings);

      const hadSuccessfulImport = importResults.some((result) => result.status === 'success');
      if (hadSuccessfulImport) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['shifts'] }),
          queryClient.invalidateQueries({ queryKey: ['summary'] }),
          queryClient.invalidateQueries({ queryKey: ['active-shift'] })
        ]);
      }

      const resultMap = new Map(importResults.map((result) => [result.line, result]));
      const errorMap = new Map(errors.filter((error) => error.line !== 1).map((error) => [error.line, error.message]));

      const rowStatuses: ImportRowStatus[] = rows.map((row) => {
        const parseErrorMessage = errorMap.get(row.line);
        if (parseErrorMessage) {
          return { ...row, status: 'failed', message: parseErrorMessage };
        }

        const importResult = resultMap.get(row.line);
        if (importResult) {
          return {
            ...row,
            status: importResult.status,
            message:
              importResult.status === 'success'
                ? 'Imported successfully'
                : importResult.message ?? undefined
          };
        }

        return {
          ...row,
          status: 'failed',
          message: 'Row skipped due to an unknown issue'
        };
      });

      const summary = rowStatuses.reduce(
        (accumulator, row) => {
          accumulator.total += 1;
          accumulator[row.status] += 1;
          return accumulator;
        },
        { total: 0, success: 0, duplicate: 0, overlap: 0, failed: 0 }
      );

      const logContent = buildLogContent(rowStatuses, errors);
      const logBlob = new Blob([logContent], { type: 'text/csv;charset=utf-8' });
      const logUrl = URL.createObjectURL(logBlob);

      setDataErrors(errors.filter((error) => error.line !== 1));
      setReview((previous) => {
        if (previous?.logUrl) {
          URL.revokeObjectURL(previous.logUrl);
        }
        return {
          rows: rowStatuses,
          summary,
          logUrl
        };
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to import shifts.');
      resetReview();
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    return () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      resetReview();
    };
  }, [resetReview]);

  return (
    <div className="flex flex-col gap-6">
      {review ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3 sm:flex-1 sm:min-w-0">
              <div>
                <h3 className="text-base font-semibold">Import results</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-300">
                  Imported {review.summary.success} of {review.summary.total} row{review.summary.total === 1 ? '' : 's'}.
                </p>
              </div>
              {review.summary.success > 0 && (
                <div
                  className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 sm:max-w-xl"
                  role="status"
                  aria-live="polite"
                >
                  Imported successfully
                  {review.summary.total > 1
                    ? `: added ${review.summary.success} new shift${review.summary.success === 1 ? '' : 's'} from the CSV.`
                    : '.'}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={triggerFilePicker}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-midnight-700 dark:text-neutral-200 dark:hover:border-midnight-500"
                disabled={isProcessing || !settings}
              >
                <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
                Import another CSV
              </button>
              <a
                href={review.logUrl}
                download={IMPORT_LOG_FILENAME}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                Download log
              </a>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-neutral-100 p-4 dark:bg-midnight-900/40 sm:grid-cols-4">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-300">Imported</span>
              <span className="text-lg font-semibold">{review.summary.success}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-300">Duplicates</span>
              <span className="text-lg font-semibold">{review.summary.duplicate}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-300">Overlapping</span>
              <span className="text-lg font-semibold">{review.summary.overlap}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-300">Failed</span>
              <span className="text-lg font-semibold">{review.summary.failed}</span>
            </div>
          </div>

          <div className="max-h-72 overflow-auto rounded-2xl border border-neutral-200 dark:border-midnight-800">
            <table className="min-w-full divide-y divide-neutral-200 text-left text-sm dark:divide-midnight-800">
              <thead className="bg-neutral-100 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:bg-midnight-900/40 dark:text-neutral-300">
                <tr>
                  <th className="px-4 py-3">Line</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">Finish</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-midnight-800">
                {review.rows.map((row) => {
                  const status = STATUS_COPY[row.status];
                  return (
                    <tr key={row.line} className="align-top">
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500 dark:text-neutral-300">{row.line}</td>
                      <td className="px-4 py-3">{row.date}</td>
                      <td className="px-4 py-3">{row.start}</td>
                      <td className="px-4 py-3">{row.finish}</td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-200">{row.note || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-200">{row.message ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {dataErrors.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-600/60 dark:bg-amber-900/30 dark:text-amber-100">
              <p className="font-semibold">Rows with issues</p>
              <ul className="mt-2 space-y-1">
                {dataErrors.map((error) => (
                  <li key={`${error.line}-${error.message}`}>
                    Line {error.line}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isProcessing}
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                Download all shifts (CSV)
              </button>
              <button
                type="button"
                onClick={triggerFilePicker}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-900 dark:border-midnight-700 dark:text-neutral-200 dark:hover:border-midnight-500"
                disabled={isProcessing || !settings}
                title={!settings ? 'Settings are still loading' : undefined}
              >
                <ArrowUpTrayIcon className="h-4 w-4" aria-hidden="true" />
                Import shifts from CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-100 p-4 text-sm text-neutral-600 dark:border-midnight-800 dark:bg-midnight-900/50 dark:text-neutral-200">
              <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-100">CSV format</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Use header columns: <code>date,start,finish,notes</code>.</li>
                <li>Date must be in <code>YYYY-MM-DD</code> format.</li>
                <li>Times use 24-hour <code>HH:mm</code>; overnight shifts roll to the next day automatically.</li>
                <li>Notes are optional and can be left blank.</li>
                <li>Duplicate or overlapping rows will be skipped and logged.</li>
              </ul>
              <a
                href={templateHref}
                download="shift-import-template.csv"
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Download template CSV
              </a>
            </div>

            {(infoMessage || errorMessage) && (
              <div className="space-y-3">
                {infoMessage && (
                  <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                    {infoMessage}
                  </p>
                )}
                {errorMessage && (
                  <p className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}
          </>
        )}
    </div>
  );
}
