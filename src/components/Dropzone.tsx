import { useCallback, useRef, useState } from 'react';

interface Props {
  onFiles: (files: File[]) => void;
  accept?: string;
  hint?: string;
}

async function collectFilesFromItems(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  if (entries.length === 0) {
    for (let i = 0; i < items.length; i++) {
      const f = items[i].getAsFile();
      if (f) files.push(f);
    }
    return files;
  }

  async function walk(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        (entry as FileSystemFileEntry).file((file) => {
          files.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readAll = (): Promise<FileSystemEntry[]> =>
        new Promise((resolve) => reader.readEntries((ents) => resolve(ents)));
      let batch = await readAll();
      while (batch.length > 0) {
        for (const e of batch) await walk(e);
        batch = await readAll();
      }
    }
  }

  for (const entry of entries) await walk(entry);
  return files;
}

export function Dropzone({ onFiles, accept, hint }: Props) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setActive(false);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        const files = await collectFilesFromItems(e.dataTransfer.items);
        if (files.length) onFiles(files);
      } else if (e.dataTransfer.files.length) {
        onFiles(Array.from(e.dataTransfer.files));
      }
    },
    [onFiles],
  );

  return (
    <div
      className={`dropzone${active ? ' active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
    >
      <div style={{ fontSize: 28 }}>📂</div>
      <h3>Drop files or folders here</h3>
      <p>{hint ?? 'Or click to browse your device'}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        hidden
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}
