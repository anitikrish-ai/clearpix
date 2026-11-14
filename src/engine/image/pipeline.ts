import type { ImageJobSettings, ProcessedImageResult, Rect } from './types';
import { MIME_BY_FORMAT } from './types';
import { bitmapToCanvas, canvasToBlob, computeResizedDimensions, cropBitmap, detectFormat, get2dContext, loadBitmap, makeCanvas } from './transform';
import { blurRegions, inpaint, redactRegions } from './overlay';

/** Runs the full, ordered processing pipeline for one image file against its job settings. */
export async function processImage(file: File, settings: ImageJobSettings): Promise<ProcessedImageResult> {
  let bitmap = await loadBitmap(file);

  if (settings.crop) {
    const cropped = await cropBitmap(bitmap, settings.crop);
    bitmap.close();
    bitmap = cropped;
  }

  let canvas = await bitmapToCanvas(bitmap);
  bitmap.close();

  if (settings.redactRegions?.length) {
    redactRegions(canvas, settings.redactRegions);
  }
  if (settings.blurRegions?.length) {
    blurRegions(canvas, settings.blurRegions);
  }
  if (settings.inpaintMask) {
    const maskImg = await loadImageFromDataUrl(settings.inpaintMask);
    const maskCanvas = makeCanvas(canvas.width, canvas.height);
    const maskCtx = get2dContext(maskCanvas);
    maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
    await inpaint(canvas, maskCanvas);
  }

  if (settings.resize) {
    const dims = computeResizedDimensions(canvas.width, canvas.height, settings.resize);
    if (dims.width !== canvas.width || dims.height !== canvas.height) {
      const resized = makeCanvas(dims.width, dims.height);
      const rctx = get2dContext(resized);
      rctx.imageSmoothingEnabled = true;
      rctx.imageSmoothingQuality = 'high';
      rctx.drawImage(canvas as any, 0, 0, dims.width, dims.height);
      canvas = resized;
    }
  }

  const format = settings.export?.format ?? detectFormat(file);
  const mime = MIME_BY_FORMAT[format];
  const quality = settings.export?.quality ?? 0.92;

  // stripMetadata is implicit here: re-encoding through canvas always drops EXIF/XMP/IPTC.
  // The flag only governs whether the UI treats it as an explicit, consented step.
  const blob = await canvasToBlob(canvas, mime, quality);

  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    format,
    originalSize: file.size,
    resultSize: blob.size,
  };
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export type { Rect };
