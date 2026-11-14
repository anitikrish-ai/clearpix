import { MIME_BY_FORMAT, type ExportOptions, type ImageFormat, type Rect, type ResizeOptions } from './types';

export async function loadBitmap(source: File | Blob): Promise<ImageBitmap> {
  return await createImageBitmap(source);
}

export function detectFormat(file: File): ImageFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpeg';
  if (name.endsWith('.webp')) return 'webp';
  if (name.endsWith('.bmp')) return 'bmp';
  if (name.endsWith('.tif') || name.endsWith('.tiff')) return 'tiff';
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/bmp') return 'bmp';
  if (file.type === 'image/tiff') return 'tiff';
  return 'jpeg';
}

export function computeResizedDimensions(
  srcW: number,
  srcH: number,
  opts: ResizeOptions,
): { width: number; height: number } {
  const { width, height, maintainAspect = true } = opts;
  if (!width && !height) return { width: srcW, height: srcH };
  if (width && height && !maintainAspect) return { width, height };
  if (width && !height) {
    return { width, height: Math.round((srcH / srcW) * width) };
  }
  if (height && !width) {
    return { width: Math.round((srcW / srcH) * height), height };
  }
  // both given + maintainAspect: fit within box
  const scale = Math.min((width as number) / srcW, (height as number) / srcH);
  return { width: Math.round(srcW * scale), height: Math.round(srcH * scale) };
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2dContext(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  return ctx;
}

export async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return await (canvas as OffscreenCanvas).convertToBlob({ type: mimeType, quality });
  }
  return await new Promise<Blob>((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      mimeType,
      quality,
    );
  });
}

/** Crops a region from an image bitmap, returning a new bitmap. */
export async function cropBitmap(bitmap: ImageBitmap, rect: Rect): Promise<ImageBitmap> {
  const x = Math.max(0, Math.round(rect.x));
  const y = Math.max(0, Math.round(rect.y));
  const w = Math.max(1, Math.min(Math.round(rect.width), bitmap.width - x));
  const h = Math.max(1, Math.min(Math.round(rect.height), bitmap.height - y));
  return await createImageBitmap(bitmap, x, y, w, h);
}

/** Resizes + exports an image bitmap to a target format/quality. */
export async function resizeAndExport(
  bitmap: ImageBitmap,
  resize: ResizeOptions | undefined,
  exportOpts: ExportOptions,
): Promise<{ blob: Blob; width: number; height: number }> {
  const dims = resize ? computeResizedDimensions(bitmap.width, bitmap.height, resize) : { width: bitmap.width, height: bitmap.height };
  const canvas = makeCanvas(dims.width, dims.height);
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, dims.width, dims.height);
  const mime = MIME_BY_FORMAT[exportOpts.format];
  const blob = await canvasToBlob(canvas, mime, exportOpts.quality);
  return { blob, width: dims.width, height: dims.height };
}

export async function bitmapToCanvas(bitmap: ImageBitmap): Promise<HTMLCanvasElement | OffscreenCanvas> {
  const canvas = makeCanvas(bitmap.width, bitmap.height);
  const ctx = get2dContext(canvas);
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}
