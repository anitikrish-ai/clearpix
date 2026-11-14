import { cleanHtml, type HtmlCleanOptions } from './html';
import { cleanText, inspectText, type CleanTextOptions, type TextInspectionReport } from './unicode';
import { readDocx, writeCleanedDocx } from './docx';
import type { MetadataEntry } from '../image/types';

export type TextFileFormat = 'txt' | 'md' | 'html' | 'docx' | 'csv' | 'json';

export function detectTextFormat(file: File): TextFileFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'md';
  if (name.endsWith('.csv')) return 'csv';
  if (name.endsWith('.json')) return 'json';
  return 'txt';
}

export interface TextLoadResult {
  format: TextFileFormat;
  rawText: string;
  displayText: string;
  metadata: MetadataEntry[];
  inspection: TextInspectionReport;
}

/** Loads a text-family file, returning its analyzable plain text plus any embedded metadata. */
export async function loadTextFile(file: File): Promise<TextLoadResult> {
  const format = detectTextFormat(file);

  if (format === 'docx') {
    const { text, html, metadata } = await readDocx(file);
    return { format, rawText: text, displayText: html, metadata, inspection: inspectText(text) };
  }

  const raw = await file.text();
  return { format, rawText: raw, displayText: raw, metadata: [], inspection: inspectText(raw) };
}

export interface TextJobSettings {
  clean: CleanTextOptions;
  html?: HtmlCleanOptions;
}

export interface TextProcessResult {
  blob: Blob;
  cleanedText: string;
  fileName: string;
}

/** Cleans a text-family file per job settings and produces an output blob in the same format. */
export async function processTextFile(file: File, settings: TextJobSettings): Promise<TextProcessResult> {
  const format = detectTextFormat(file);
  const baseName = file.name.replace(/\.[^.]+$/, '');

  if (format === 'docx') {
    const { text } = await readDocx(file);
    const cleaned = cleanText(text, settings.clean);
    const blob = await writeCleanedDocx(cleaned);
    return { blob, cleanedText: cleaned, fileName: `${baseName}.cleaned.docx` };
  }

  const raw = await file.text();

  if (format === 'html') {
    const sanitized = cleanHtml(raw, settings.html);
    const cleaned = cleanText(sanitized, settings.clean);
    return { blob: new Blob([cleaned], { type: 'text/html' }), cleanedText: cleaned, fileName: `${baseName}.cleaned.html` };
  }

  if (format === 'json') {
    let cleaned: string;
    try {
      const parsed = JSON.parse(raw);
      cleaned = JSON.stringify(cleanJsonValue(parsed, settings.clean), null, 2);
    } catch {
      cleaned = cleanText(raw, settings.clean);
    }
    return { blob: new Blob([cleaned], { type: 'application/json' }), cleanedText: cleaned, fileName: `${baseName}.cleaned.json` };
  }

  const cleaned = cleanText(raw, settings.clean);
  const mime = format === 'csv' ? 'text/csv' : format === 'md' ? 'text/markdown' : 'text/plain';
  const ext = format === 'csv' ? 'csv' : format === 'md' ? 'md' : 'txt';
  return { blob: new Blob([cleaned], { type: mime }), cleanedText: cleaned, fileName: `${baseName}.cleaned.${ext}` };
}

function cleanJsonValue(value: unknown, opts: CleanTextOptions): unknown {
  if (typeof value === 'string') return cleanText(value, opts);
  if (Array.isArray(value)) return value.map((v) => cleanJsonValue(v, opts));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[cleanText(k, opts)] = cleanJsonValue(v, opts);
    }
    return out;
  }
  return value;
}
