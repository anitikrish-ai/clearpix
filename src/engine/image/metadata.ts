import * as exifr from 'exifr';
import type { MetadataEntry, MetadataReport, ProvenanceSignal } from './types';

function flattenGroup(group: MetadataEntry['group'], obj: unknown, entries: MetadataEntry[]) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, raw] of Object.entries(obj as Record<string, unknown>)) {
    if (raw === undefined || raw === null) continue;
    let value: string;
    if (raw instanceof Uint8Array || Array.isArray(raw)) {
      value = `[${(raw as unknown[]).length} bytes/items]`;
    } else if (raw instanceof Date) {
      value = raw.toISOString();
    } else if (typeof raw === 'object') {
      try {
        value = JSON.stringify(raw);
      } catch {
        value = String(raw);
      }
    } else {
      value = String(raw);
    }
    if (value.length > 500) value = value.slice(0, 500) + '…';
    entries.push({ group, key, value });
  }
}

/** Scans raw bytes for documented provenance/AI container markers (C2PA JUMBF boxes). */
function scanForC2pa(bytes: Uint8Array): boolean {
  const needle = new TextEncoder().encode('C2PA');
  const jumbNeedle = new TextEncoder().encode('jumb');
  const caBxNeedle = new TextEncoder().encode('caBX');
  const hasNeedle = (n: Uint8Array) => {
    outer: for (let i = 0; i <= bytes.length - n.length; i++) {
      for (let j = 0; j < n.length; j++) {
        if (bytes[i + j] !== n[j]) continue outer;
      }
      return true;
    }
    return false;
  };
  return hasNeedle(needle) || hasNeedle(jumbNeedle) || hasNeedle(caBxNeedle);
}

const DIGITAL_SOURCE_KEYS = ['DigitalSourceType', 'digitalsourcetype', 'DigitalSourceFileType'];

export async function readMetadata(file: File): Promise<MetadataReport> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const entries: MetadataEntry[] = [];
  const provenance: ProvenanceSignal[] = [];

  try {
    const parsed = (await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      iptc: true,
      icc: true,
      jfif: true,
      ihdr: true,
      mergeOutput: false,
    })) as Record<string, unknown> | undefined;

    if (parsed) {
      flattenGroup('EXIF', { ...(parsed.exif as object), ...(parsed.tiff as object), ...(parsed.gps as object) }, entries);
      flattenGroup('XMP', parsed.xmp, entries);
      flattenGroup('IPTC', parsed.iptc, entries);
      flattenGroup('ICC', parsed.icc, entries);

      const software = (parsed.exif as Record<string, unknown> | undefined)?.Software;
      if (software) {
        provenance.push({
          type: 'software-tag',
          label: 'Editing/creation software tag',
          detail: String(software),
        });
      }

      for (const group of [parsed.iptc, parsed.xmp]) {
        if (!group || typeof group !== 'object') continue;
        for (const key of DIGITAL_SOURCE_KEYS) {
          const val = (group as Record<string, unknown>)[key];
          if (val) {
            provenance.push({
              type: 'digital-source-type',
              label: 'IPTC/XMP Digital Source Type',
              detail: String(val),
            });
          }
        }
      }
    }
  } catch {
    // Unreadable/absent metadata is not an error for this tool; continue.
  }

  if (scanForC2pa(bytes)) {
    provenance.push({
      type: 'c2pa-jumbf',
      label: 'C2PA / JUMBF content-credentials marker',
      detail: 'A JUMBF box signature associated with C2PA content credentials was found in the file bytes.',
    });
  }

  return {
    entries,
    provenance,
    hasAnyMetadata: entries.length > 0,
  };
}

/**
 * Removes ordinary metadata (EXIF/XMP/IPTC/ICC) by re-encoding the pixel data onto a
 * fresh canvas and exporting a new file. This naturally drops auxiliary metadata chunks
 * because only pixel data is carried through the canvas pipeline. It does not touch or
 * attempt to detect/strip proprietary invisible watermarking.
 */
export async function stripMetadata(file: File, mimeType: string, quality = 0.92): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      mimeType,
      quality,
    );
  });
}
