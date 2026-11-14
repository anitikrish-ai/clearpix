import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import { Document, Packer, Paragraph } from 'docx';
import type { MetadataEntry } from '../image/types';

export interface DocxReadResult {
  text: string;
  html: string;
  metadata: MetadataEntry[];
}

const CORE_PROPS = ['title', 'subject', 'creator', 'keywords', 'description', 'lastModifiedBy', 'revision', 'created', 'modified'];

/** Extracts readable text/HTML plus core document properties from a .docx file. */
export async function readDocx(file: File): Promise<DocxReadResult> {
  const buffer = await file.arrayBuffer();
  const [textResult, htmlResult, metadata] = await Promise.all([
    mammoth.extractRawText({ arrayBuffer: buffer }),
    mammoth.convertToHtml({ arrayBuffer: buffer }),
    readDocxCoreProps(buffer.slice(0)),
  ]);
  return { text: textResult.value, html: htmlResult.value, metadata };
}

async function readDocxCoreProps(buffer: ArrayBuffer): Promise<MetadataEntry[]> {
  const entries: MetadataEntry[] = [];
  try {
    const zip = await JSZip.loadAsync(buffer);
    const coreXml = await zip.file('docProps/core.xml')?.async('text');
    if (coreXml) {
      const doc = new DOMParser().parseFromString(coreXml, 'application/xml');
      for (const prop of CORE_PROPS) {
        const els = doc.getElementsByTagNameNS('*', prop);
        if (els.length && els[0].textContent) {
          entries.push({ group: 'OTHER', key: `docProps:${prop}`, value: els[0].textContent });
        }
      }
    }
    const appXml = await zip.file('docProps/app.xml')?.async('text');
    if (appXml) {
      const doc = new DOMParser().parseFromString(appXml, 'application/xml');
      const app = doc.getElementsByTagNameNS('*', 'Application')[0]?.textContent;
      if (app) entries.push({ group: 'OTHER', key: 'docProps:Application', value: app });
    }
  } catch {
    // Not a valid zip / unreadable properties — report nothing rather than failing the job.
  }
  return entries;
}

/** Builds a new, metadata-stripped .docx from cleaned plain text (paragraph per line). */
export async function writeCleanedDocx(cleanedText: string): Promise<Blob> {
  const paragraphs = cleanedText.split(/\r?\n/).map((line) => new Paragraph(line));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return await Packer.toBlob(doc);
}
