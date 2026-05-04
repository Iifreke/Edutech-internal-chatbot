import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// pdf-parse uses pdfjs-dist which references DOMMatrix at init in serverless envs
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() { this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0; }
  };
}

export async function parsePDF(buffer) {
  const pdfParse = (await import('pdf-parse')).default;
  const result = await pdfParse(buffer);
  return result.text || '';
}

/**
 * Parse a DOCX file buffer into plain text
 */
export async function parseDOCX(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value || '';
}

/**
 * Parse an XLSX/XLS file buffer into readable text
 * Converts each sheet into a formatted text table
 */
export function parseXLSX(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const textParts = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length === 0) continue;

    textParts.push(`\n--- Sheet: ${sheetName} ---\n`);

    // First row as headers
    const headers = jsonData[0] || [];
    textParts.push(headers.join(' | '));
    textParts.push('---'.repeat(headers.length));

    // Data rows
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row.length > 0) {
        const rowText = headers
          .map((header, idx) => `${header}: ${row[idx] ?? ''}`)
          .join(', ');
        textParts.push(rowText);
      }
    }
  }

  return textParts.join('\n');
}

/**
 * Auto-detect file type and parse accordingly
 */
export async function parseFile(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'pdf':
      return await parsePDF(buffer);
    case 'docx':
    case 'doc':
      return await parseDOCX(buffer);
    case 'xlsx':
    case 'xls':
    case 'csv':
      return parseXLSX(buffer);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}

/**
 * Get the file type category from filename
 */
export function getFileType(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  const typeMap = {
    pdf: 'pdf',
    doc: 'docx',
    docx: 'docx',
    xls: 'xlsx',
    xlsx: 'xlsx',
    csv: 'xlsx',
  };
  return typeMap[ext] || 'unknown';
}
