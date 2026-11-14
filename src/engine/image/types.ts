export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'bmp' | 'tiff';

export const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
};

export const SUPPORTED_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'];

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MetadataEntry {
  group: 'EXIF' | 'XMP' | 'IPTC' | 'ICC' | 'OTHER';
  key: string;
  value: string;
}

export interface ProvenanceSignal {
  type: string;
  label: string;
  detail: string;
}

export interface MetadataReport {
  entries: MetadataEntry[];
  provenance: ProvenanceSignal[];
  hasAnyMetadata: boolean;
}

export interface ResizeOptions {
  width?: number;
  height?: number;
  maintainAspect?: boolean;
}

export interface ExportOptions {
  format: ImageFormat;
  quality?: number; // 0-1, used for jpeg/webp
}

export interface ImageJobSettings {
  resize?: ResizeOptions;
  crop?: Rect;
  export?: ExportOptions;
  stripMetadata?: boolean;
  redactRegions?: Rect[];
  blurRegions?: Rect[];
  inpaintMask?: string; // data URL of a black/white mask, white = inpaint area
}

export interface ProcessedImageResult {
  blob: Blob;
  width: number;
  height: number;
  format: ImageFormat;
  originalSize: number;
  resultSize: number;
}
