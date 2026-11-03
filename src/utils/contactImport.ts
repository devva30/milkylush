// Turns a spreadsheet of contacts that came from somewhere else into a clean list
// to message. Self-contained, with no browser or framework dependencies, so it can
// be tested against awkward files directly.
//
// Files like this are never tidy: phone numbers arrive as numbers, as text with
// spaces and a +91, with a leading zero, or half-typed; a header row may or may
// not be present; the same person is often listed twice. Everything here exists
// because messaging the wrong number, or the same person twice, is a real cost.

export interface ImportedContact {
  name: string;
  /** Always 91 followed by a 10-digit Indian mobile number. */
  phone: string;
}

export interface ImportResult {
  /** The header row when there is one, otherwise null. */
  headers: string[] | null;
  columnCount: number;
  /** Column indexes in use, which the person can override. */
  phoneColumn: number;
  nameColumn: number | null;
  contacts: ImportedContact[];
  rows: number;
  duplicates: number;
  invalid: number;
  /** A few of the values that were rejected, so the person can see why. */
  invalidSamples: string[];
  /** The first few rows as text, for showing what was understood. */
  preview: string[][];
}

const DEFAULT_NAME = 'Customer';

/** A cell as plain text. Excel hands phone numbers over as numbers, not strings. */
const cellText = (cell: unknown): string => {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') return Number.isFinite(cell) ? String(Math.round(cell)) : '';
  if (cell instanceof Date) return '';
  return String(cell).trim();
};

/** Indian mobile numbers only: the sender and the message routes support no others. */
export function normalizeIndianMobile(raw: unknown): string | null {
  let digits = cellText(raw).replace(/\D/g, '');
  if (digits.startsWith('0091') && digits.length === 14) digits = digits.slice(2);
  if (digits.startsWith('091') && digits.length === 13) digits = digits.slice(1);
  if (digits.startsWith('0') && digits.length === 11) digits = `91${digits.slice(1)}`;
  if (digits.length === 10) digits = `91${digits}`;
  return /^91[6-9]\d{9}$/.test(digits) ? digits : null;
}

const looksLikePhoneCell = (cell: unknown): boolean => {
  const text = cellText(cell);
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 14 && digits.length >= text.replace(/[\s+\-().]/g, '').length * 0.8;
};

const PHONE_HEADER = /phone|mobile|whats\s*app|contact|number|mob\b|cell|tel\b/i;
const NAME_HEADER = /name|customer|client|person/i;

/** Parses CSV text: quoted fields, doubled quotes, newlines inside quotes, any common delimiter. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');

  // Spreadsheets in some locales save with ; or tabs, so look at the first line.
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const sep = counts[delimiter] > 0 ? delimiter : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Works out which column holds the phone numbers and which the names, and returns
 * the clean list. The person can override either column afterwards.
 */
export function analyseRows(
  rawRows: unknown[][],
  override: { phone?: number; name?: number | null } = {}
): ImportResult {
  const rows = rawRows.filter((r) => Array.isArray(r) && r.some((c) => cellText(c) !== ''));
  const columnCount = rows.reduce((n, r) => Math.max(n, r.length), 0);

  // A first row with no phone-like cell is a header; a data row always has one.
  const hasHeader = rows.length > 0 && !rows[0].some(looksLikePhoneCell);
  const headers = hasHeader ? Array.from({ length: columnCount }, (_, i) => cellText(rows[0][i])) : null;
  const data = hasHeader ? rows.slice(1) : rows;

  const validInColumn = (col: number) => data.slice(0, 300).filter((r) => normalizeIndianMobile(r[col]) !== null).length;

  let phoneColumn = override.phone ?? -1;
  if (phoneColumn < 0) {
    const byHeader = headers ? headers.findIndex((h) => PHONE_HEADER.test(h) && !NAME_HEADER.test(h)) : -1;
    if (byHeader >= 0 && validInColumn(byHeader) > 0) {
      phoneColumn = byHeader;
    } else {
      let best = -1, bestCount = 0;
      for (let c = 0; c < columnCount; c++) {
        const n = validInColumn(c);
        if (n > bestCount) { best = c; bestCount = n; }
      }
      phoneColumn = best;
    }
  }

  let nameColumn: number | null = override.name === undefined ? null : override.name;
  if (override.name === undefined) {
    const byHeader = headers ? headers.findIndex((h, i) => i !== phoneColumn && NAME_HEADER.test(h)) : -1;
    if (byHeader >= 0) {
      nameColumn = byHeader;
    } else if (!headers) {
      // Without a header, take the first other column that is mostly words.
      for (let c = 0; c < columnCount; c++) {
        if (c === phoneColumn) continue;
        const sample = data.slice(0, 50).map((r) => cellText(r[c])).filter(Boolean);
        if (sample.length && sample.filter((v) => /[A-Za-z]/.test(v) && !/^\d+$/.test(v)).length >= sample.length * 0.6) {
          nameColumn = c;
          break;
        }
      }
    }
  }

  const contacts: ImportedContact[] = [];
  const seen = new Set<string>();
  let duplicates = 0, invalid = 0;
  const invalidSamples: string[] = [];

  if (phoneColumn >= 0) {
    for (const r of data) {
      const raw = cellText(r[phoneColumn]);
      if (raw === '') continue;

      const phone = normalizeIndianMobile(r[phoneColumn]);
      if (!phone) {
        invalid++;
        if (invalidSamples.length < 5) invalidSamples.push(raw.slice(0, 24));
        continue;
      }
      if (seen.has(phone)) { duplicates++; continue; }
      seen.add(phone);

      const name = nameColumn !== null ? cellText(r[nameColumn]).replace(/\s+/g, ' ').slice(0, 60) : '';
      contacts.push({ name: name || DEFAULT_NAME, phone });
    }
  }

  return {
    headers,
    columnCount,
    phoneColumn,
    nameColumn,
    contacts,
    rows: data.length,
    duplicates,
    invalid,
    invalidSamples,
    preview: rows.slice(0, 6).map((r) => Array.from({ length: columnCount }, (_, i) => cellText(r[i]))),
  };
}
