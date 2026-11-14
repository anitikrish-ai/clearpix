import { canvasRGBA } from 'stackblur-canvas';
import type { Rect } from './types';
import { get2dContext, makeCanvas } from './transform';

/** Fills rectangular regions with solid black — a hard redaction that destroys the content. */
export function redactRegions(canvas: HTMLCanvasElement | OffscreenCanvas, regions: Rect[]) {
  const ctx = get2dContext(canvas);
  ctx.fillStyle = '#000000';
  for (const r of regions) {
    ctx.fillRect(r.x, r.y, r.width, r.height);
  }
}

/** Gaussian-style blur over rectangular regions, leaving the rest of the image untouched. */
export function blurRegions(canvas: HTMLCanvasElement | OffscreenCanvas, regions: Rect[], radius = 18) {
  for (const r of regions) {
    const x = Math.max(0, Math.round(r.x));
    const y = Math.max(0, Math.round(r.y));
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    canvasRGBA(canvas as HTMLCanvasElement, x, y, w, h, radius);
  }
}

let cvReadyPromise: Promise<any> | null = null;

/** Lazily loads the OpenCV.js WASM runtime, once per session. */
export async function getOpenCv(): Promise<any> {
  if (!cvReadyPromise) {
    cvReadyPromise = (async () => {
      const mod: any = await import('@techstark/opencv-js');
      const cv = mod.default ?? mod;
      if (cv.onRuntimeInitialized !== undefined || typeof cv.then !== 'function') {
        await new Promise<void>((resolve) => {
          if (cv.calledRun) resolve();
          else cv.onRuntimeInitialized = () => resolve();
        });
        return cv;
      }
      return await cv;
    })();
  }
  return cvReadyPromise;
}

/**
 * Removes content inside a painted mask using OpenCV's Telea inpainting algorithm,
 * reconstructing the masked pixels from surrounding texture. `maskCanvas` must be the
 * same dimensions as `canvas`; white (or any non-zero) pixels mark the area to remove.
 */
export async function inpaint(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  maskCanvas: HTMLCanvasElement | OffscreenCanvas,
  radius = 6,
): Promise<void> {
  const cv = await getOpenCv();
  const ctx = get2dContext(canvas);
  const maskCtx = get2dContext(maskCanvas);
  const w = canvas.width;
  const h = canvas.height;

  const srcImageData = ctx.getImageData(0, 0, w, h);
  const maskImageData = maskCtx.getImageData(0, 0, w, h);

  const src = cv.matFromImageData(srcImageData);
  const rgb = new cv.Mat();
  cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB);

  const maskRgba = cv.matFromImageData(maskImageData);
  const maskGray = new cv.Mat();
  cv.cvtColor(maskRgba, maskGray, cv.COLOR_RGBA2GRAY);
  const maskBin = new cv.Mat();
  cv.threshold(maskGray, maskBin, 10, 255, cv.THRESH_BINARY);

  const dst = new cv.Mat();
  cv.inpaint(rgb, maskBin, dst, radius, cv.INPAINT_TELEA);

  const rgba = new cv.Mat();
  cv.cvtColor(dst, rgba, cv.COLOR_RGB2RGBA);

  const outData = new ImageData(new Uint8ClampedArray(rgba.data), w, h);
  ctx.putImageData(outData, 0, 0);

  src.delete();
  rgb.delete();
  maskRgba.delete();
  maskGray.delete();
  maskBin.delete();
  dst.delete();
  rgba.delete();
}

/** Builds a blank black mask canvas of the given size, ready for white brush strokes. */
export function createMaskCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  const canvas = makeCanvas(width, height);
  const ctx = get2dContext(canvas);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  return canvas;
}

/**
 * A simple contrast/edge enhancement preview to help a person spot low-contrast overlays,
 * logos or watermark bands by eye. This is a visual aid only — it does not claim to
 * automatically detect or classify any specific watermark.
 */
export function enhanceContrastPreview(canvas: HTMLCanvasElement | OffscreenCanvas): HTMLCanvasElement | OffscreenCanvas {
  const ctx = get2dContext(canvas);
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const out = makeCanvas(width, height);
  const outCtx = get2dContext(out);
  const outData = outCtx.createImageData(width, height);
  const od = outData.data;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = data[i + c];
      od[i + c] = Math.min(255, Math.max(0, (v - 128) * 2.2 + 128));
    }
    od[i + 3] = 255;
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}
