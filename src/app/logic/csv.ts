import { format, isValid, parse } from 'date-fns';
import templateCsvContent from '../assets/shift-import-template.csv?raw';
import type { Shift } from '../db/schema';

export type ShiftCsvParseError = {
  line: number;
  message: string;
};

export type ShiftCsvImportEntry = {
  line: number;
  startISO: string;
  endISO: string;
  note?: string;
};

export type ShiftCsvImportRow = {
  line: number;
  date: string;
  start: string;
  finish: string;
  note: string;
};

const HEADER = ['date', 'start', 'finish', 'notes'] as const;

const DANGEROUS_CSV_PREFIXES = new Set(['=', '+', '-', '@']);

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeCsvValue(value: string): string {
  if (!value) {
    return value;
  }

  const firstChar = value[0];

  if (DANGEROUS_CSV_PREFIXES.has(firstChar) || firstChar === '\t' || firstChar === '\r' || firstChar === '\n') {
    return `'${value}`;
  }

  return value;
}

export function encodeCsvCell(value: string): string {
  return escapeCsvValue(sanitizeCsvValue(value));
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '"') {
      if (inQuotes && content[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      currentRow.push(currentValue);
      currentValue = '';
      if (char === '\r' && content[index + 1] === '\n') {
        index += 1;
      }
      rows.push(currentRow);
      currentRow = [];
      continue;
    }

    if (!inQuotes && char === ',') {
      currentRow.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  rows.push(currentRow);

  return rows;
}

function parseTime(value: string): { hours: number; minutes: number } | null {
  const trimmed = value.trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

export function shiftsToCsv(shifts: Shift[]): string {
  const lines = [HEADER.join(',')];

  shifts.forEach((shift) => {
    const startDate = new Date(shift.startISO);
    const endDate = shift.endISO ? new Date(shift.endISO) : null;
    const cells = [
      format(startDate, 'yyyy-MM-dd'),
      format(startDate, 'HH:mm'),
      endDate ? format(endDate, 'HH:mm') : '',
      shift.note ?? ''
    ];
    lines.push(cells.map(encodeCsvCell).join(','));
  });

  return lines.join('\n');
}

function trimBom(content: string): string {
  if (content.length > 0 && content.charCodeAt(0) === 0xfeff) {
    return content.slice(1);
  }
  return content;
}

export function parseShiftsCsv(content: string): {
  entries: ShiftCsvImportEntry[];
  errors: ShiftCsvParseError[];
  rows: ShiftCsvImportRow[];
} {
  const normalized = trimBom(content);
  const rows = parseCsv(normalized).filter((row) => row.some((cell) => cell.trim() !== ''));

  if (rows.length === 0) {
    return {
      entries: [],
      errors: [
        {
          line: 1,
          message: 'CSV file is empty'
        }
      ],
      rows: []
    };
  }

  const header = rows[0].map(normalizeHeader);
  if (HEADER.some((expected, index) => header[index] !== expected)) {
    return {
      entries: [],
      errors: [
        {
          line: 1,
          message: `Invalid header row. Expected: ${HEADER.join(', ')}`
        }
      ],
      rows: []
    };
  }

  const entries: ShiftCsvImportEntry[] = [];
  const errors: ShiftCsvParseError[] = [];
  const displayRows: ShiftCsvImportRow[] = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row || row.length === 0) {
      continue;
    }

    const [dateRaw = '', startRaw = '', finishRaw = '', noteRaw = ''] = row;
    const lineNumber = rowIndex + 1;
    const dateValue = dateRaw.trim();
    const startValue = startRaw.trim();
    const finishValue = finishRaw.trim();
    const note = noteRaw.trim();

    if (!dateValue && !startValue && !finishValue && !note) {
      continue;
    }

    displayRows.push({
      line: lineNumber,
      date: dateValue,
      start: startValue,
      finish: finishValue,
      note
    });

    const parsedDate = parse(dateValue, 'yyyy-MM-dd', new Date());
    if (!isValid(parsedDate)) {
      errors.push({ line: lineNumber, message: 'Date must use format YYYY-MM-DD' });
      continue;
    }

    const startTime = parseTime(startValue);
    if (!startTime) {
      errors.push({ line: lineNumber, message: 'Start time must use 24-hour HH:mm format' });
      continue;
    }

    const finishTime = parseTime(finishValue);
    if (!finishTime) {
      errors.push({ line: lineNumber, message: 'Finish time must use 24-hour HH:mm format' });
      continue;
    }

    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth();
    const day = parsedDate.getDate();

    const startDate = new Date(Date.UTC(year, month, day, startTime.hours, startTime.minutes, 0, 0));

    let endDate = new Date(Date.UTC(year, month, day, finishTime.hours, finishTime.minutes, 0, 0));

    if (endDate <= startDate) {
      endDate = new Date(Date.UTC(year, month, day + 1, finishTime.hours, finishTime.minutes, 0, 0));
    }

    const startISO = startDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    const endISO = endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');

    entries.push({
      line: lineNumber,
      startISO,
      endISO,
      note: note || undefined
    });
  }

  return { entries, errors, rows: displayRows };
}

export function getShiftImportTemplateCsv(): string {
  return templateCsvContent;
}
