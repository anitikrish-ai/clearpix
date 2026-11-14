import JSZip from 'jszip';

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export interface ZipEntry {
  name: string;
  blob: Blob;
}

export async function downloadZip(entries: ZipEntry[], zipName = 'clearpix-export.zip') {
  const zip = new JSZip();
  const usedNames = new Set<string>();
  for (const entry of entries) {
    let name = entry.name;
    let counter = 1;
    while (usedNames.has(name)) {
      const dot = entry.name.lastIndexOf('.');
      name = dot > -1 ? `${entry.name.slice(0, dot)} (${counter})${entry.name.slice(dot)}` : `${entry.name} (${counter})`;
      counter++;
    }
    usedNames.add(name);
    zip.file(name, entry.blob);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(blob, zipName);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}
