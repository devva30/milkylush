// Reads a contact file chosen in the browser into rows for contactImport.
// The Excel reader is loaded only when an .xlsx is actually chosen, so it is not
// part of the page's weight for everyone who never uploads one.

import { parseCsv } from './contactImport';

export interface LoadedSheet {
  fileName: string;
  /** The Excel sheet that was read, or null for a CSV. */
  sheetName: string | null;
  rows: unknown[][];
}

const MAX_BYTES = 5 * 1024 * 1024;

export async function loadContactFile(file: File): Promise<LoadedSheet> {
  const name = file.name;
  const lower = name.toLowerCase();

  if (file.size > MAX_BYTES) throw new Error('That file is over 5 MB. Contact lists are far smaller, so check it is the right one.');

  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    return { fileName: name, sheetName: null, rows: parseCsv(await file.text()) };
  }

  if (lower.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    // The first sheet that has anything in it; a workbook often has empty extras.
    const sheet = sheets.find((s: { data: unknown[][] }) => s.data.some((row) => row.some((c) => c !== null && c !== ''))) ?? sheets[0];
    if (!sheet) throw new Error('That Excel file has no sheets in it.');
    return { fileName: name, sheetName: sheet.sheet, rows: sheet.data as unknown[][] };
  }

  if (lower.endsWith('.xls')) {
    throw new Error('Old .xls files are not supported. In Excel choose File > Save As and pick .xlsx or CSV, then upload that.');
  }
  throw new Error('Upload an Excel (.xlsx) or CSV file.');
}
