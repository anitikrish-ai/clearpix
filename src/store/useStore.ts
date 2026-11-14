import { create } from 'zustand';
import type { ImageJobSettings, ProcessedImageResult } from '../engine/image/types';
import type { TextJobSettings, TextProcessResult } from '../engine/text/pipeline';
import { SUPPORTED_IMAGE_EXT } from '../engine/image/types';

export type FileKind = 'image' | 'text';
export type FileStatus = 'queued' | 'processing' | 'done' | 'error' | 'canceled';

export interface WorkspaceFile {
  id: string;
  file: File;
  kind: FileKind;
  status: FileStatus;
  error?: string;
  previewUrl: string;
  imageSettings: ImageJobSettings;
  textSettings: TextJobSettings;
  imageResult?: ProcessedImageResult;
  textResult?: TextProcessResult;
  resultPreviewUrl?: string;
}

export type Theme = 'light' | 'dark' | 'system';

interface StoreState {
  files: WorkspaceFile[];
  selectedId: string | null;
  theme: Theme;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  select: (id: string | null) => void;
  updateImageSettings: (id: string, patch: Partial<ImageJobSettings>) => void;
  updateTextSettings: (id: string, patch: Partial<TextJobSettings>) => void;
  setStatus: (id: string, status: FileStatus, error?: string) => void;
  setImageResult: (id: string, result: ProcessedImageResult) => void;
  setTextResult: (id: string, result: TextProcessResult) => void;
  setTheme: (theme: Theme) => void;
}

function detectKind(file: File): FileKind {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (SUPPORTED_IMAGE_EXT.includes(ext)) return 'image';
  return 'text';
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useStore = create<StoreState>((set, get) => ({
  files: [],
  selectedId: null,
  theme: (localStorage.getItem('clearpix-theme') as Theme) || 'system',

  addFiles: (newFiles) => {
    const entries: WorkspaceFile[] = newFiles.map((file) => {
      const kind = detectKind(file);
      return {
        id: makeId(),
        file,
        kind,
        status: 'queued',
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : '',
        imageSettings: { stripMetadata: false, redactRegions: [], blurRegions: [] },
        textSettings: {
          clean: { removeZeroWidth: true, removeBidiControl: true, removeVariationSelectors: false, removeUnicodeTags: false, normalizeWhitespace: false, unicodeNormalForm: 'none' },
          html: { stripStyleAttributes: false, stripClassAttributes: false, stripComments: true },
        },
      };
    });
    set((state) => ({ files: [...state.files, ...entries], selectedId: state.selectedId ?? entries[0]?.id ?? null }));
  },

  removeFile: (id) => {
    const target = get().files.find((f) => f.id === id);
    if (target) {
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target.resultPreviewUrl) URL.revokeObjectURL(target.resultPreviewUrl);
    }
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },

  clearFiles: () => {
    for (const f of get().files) {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      if (f.resultPreviewUrl) URL.revokeObjectURL(f.resultPreviewUrl);
    }
    set({ files: [], selectedId: null });
  },

  select: (id) => set({ selectedId: id }),

  updateImageSettings: (id, patch) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, imageSettings: { ...f.imageSettings, ...patch } } : f)),
    })),

  updateTextSettings: (id, patch) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, textSettings: { ...f.textSettings, ...patch } } : f)),
    })),

  setStatus: (id, status, error) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, status, error } : f)),
    })),

  setImageResult: (id, result) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f;
        if (f.resultPreviewUrl) URL.revokeObjectURL(f.resultPreviewUrl);
        return { ...f, imageResult: result, resultPreviewUrl: URL.createObjectURL(result.blob), status: 'done' };
      }),
    })),

  setTextResult: (id, result) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, textResult: result, status: 'done' } : f)),
    })),

  setTheme: (theme) => {
    localStorage.setItem('clearpix-theme', theme);
    set({ theme });
  },
}));
