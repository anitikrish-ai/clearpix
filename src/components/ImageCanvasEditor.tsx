import { useEffect, useRef, useState } from 'react';
import type { Rect } from '../engine/image/types';

export type EditTool = 'pan' | 'crop' | 'redact' | 'blur' | 'brush';

interface Props {
  src: string;
  naturalWidth: number;
  naturalHeight: number;
  tool: EditTool;
  brushSize: number;
  cropRect: Rect | null;
  onCropChange: (rect: Rect | null) => void;
  redactRects: Rect[];
  onRedactRectsChange: (rects: Rect[]) => void;
  blurRects: Rect[];
  onBlurRectsChange: (rects: Rect[]) => void;
  maskCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  showMask: boolean;
}

/**
 * Renders the image plus an interaction overlay for crop/redact/blur rectangles and
 * freehand brush strokes (collected into a mask canvas for inpainting). All coordinates
 * are tracked in natural image pixels, independent of on-screen zoom.
 */
export function ImageCanvasEditor({
  src,
  naturalWidth,
  naturalHeight,
  tool,
  brushSize,
  cropRect,
  onCropChange,
  redactRects,
  onRedactRectsChange,
  blurRects,
  onBlurRectsChange,
  maskCanvasRef,
  showMask,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const currentRect = useRef<Rect | null>(null);

  useEffect(() => {
    if (!maskCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = naturalWidth;
      canvas.height = naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, naturalWidth, naturalHeight);
      maskCanvasRef.current = canvas;
    }
  }, [naturalWidth, naturalHeight, maskCanvasRef]);

  const fitScale = () => {
    const el = wrapRef.current;
    if (!el) return 1;
    const scale = Math.min((el.clientWidth - 28) / naturalWidth, (el.clientHeight - 28) / naturalHeight, 1);
    return scale > 0 ? scale : 1;
  };

  const [baseScale, setBaseScale] = useState(1);
  useEffect(() => {
    setBaseScale(fitScale());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naturalWidth, naturalHeight]);

  const totalScale = baseScale * zoom;

  const toImageCoords = (clientX: number, clientY: number): { x: number; y: number } => {
    const el = overlayRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / totalScale,
      y: (clientY - rect.top) / totalScale,
    };
  };

  const redrawOverlay = () => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#0a84ff';
    ctx.lineWidth = 2 / totalScale;
    ctx.fillStyle = 'rgba(10,132,255,0.15)';

    if (cropRect) {
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
      ctx.fillRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
    }
    ctx.strokeStyle = '#ff3b30';
    ctx.fillStyle = 'rgba(255,59,48,0.18)';
    for (const r of redactRects) {
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }
    ctx.strokeStyle = '#ff9f0a';
    ctx.fillStyle = 'rgba(255,159,10,0.18)';
    for (const r of blurRects) {
      ctx.fillRect(r.x, r.y, r.width, r.height);
      ctx.strokeRect(r.x, r.y, r.width, r.height);
    }
    const cur = currentRect.current;
    if (cur && tool !== 'brush') {
      ctx.strokeStyle = tool === 'crop' ? '#0a84ff' : tool === 'redact' ? '#ff3b30' : '#ff9f0a';
      ctx.strokeRect(cur.x, cur.y, cur.width, cur.height);
    }

    if (showMask && maskCanvasRef.current) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(maskCanvasRef.current, 0, 0);
      ctx.globalAlpha = 1;
    }
  };

  // maskCanvasRef is a ref — reading it here doesn't need to retrigger this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(redrawOverlay, [cropRect, redactRects, blurRects, tool, totalScale, showMask]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (tool === 'pan') {
      drawing.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
      return;
    }
    const p = toImageCoords(e.clientX, e.clientY);
    drawing.current = true;
    dragStart.current = p;

    if (tool === 'brush') {
      const mctx = maskCanvasRef.current?.getContext('2d');
      if (mctx) {
        mctx.fillStyle = '#fff';
        mctx.beginPath();
        mctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
        mctx.fill();
      }
      redrawOverlay();
    } else {
      currentRect.current = { x: p.x, y: p.y, width: 0, height: 0 };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    if (tool === 'pan') {
      setPan({ x: panStart.current.x + (e.clientX - dragStart.current.x), y: panStart.current.y + (e.clientY - dragStart.current.y) });
      return;
    }
    const p = toImageCoords(e.clientX, e.clientY);
    if (tool === 'brush') {
      const mctx = maskCanvasRef.current?.getContext('2d');
      if (mctx) {
        mctx.fillStyle = '#fff';
        mctx.beginPath();
        mctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
        mctx.fill();
      }
      redrawOverlay();
      return;
    }
    const start = dragStart.current;
    currentRect.current = {
      x: Math.min(start.x, p.x),
      y: Math.min(start.y, p.y),
      width: Math.abs(p.x - start.x),
      height: Math.abs(p.y - start.y),
    };
    redrawOverlay();
  };

  const handlePointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (tool === 'pan' || tool === 'brush') return;
    const r = currentRect.current;
    currentRect.current = null;
    if (!r || r.width < 3 || r.height < 3) {
      redrawOverlay();
      return;
    }
    if (tool === 'crop') onCropChange(r);
    if (tool === 'redact') onRedactRectsChange([...redactRects, r]);
    if (tool === 'blur') onBlurRectsChange([...blurRects, r]);
    redrawOverlay();
  };

  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height: '100%', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', touchAction: 'none' }}
      onWheel={(e) => {
        e.preventDefault();
        setZoom((z) => Math.min(6, Math.max(0.2, z * (e.deltaY < 0 ? 1.08 : 0.92))));
      }}
    >
      <div
        style={{
          position: 'relative',
          width: naturalWidth * totalScale,
          height: naturalHeight * totalScale,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          cursor: tool === 'pan' ? 'grab' : 'crosshair',
        }}
      >
        <img src={src} alt="editing subject" style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }} draggable={false} />
        <canvas
          ref={overlayRef}
          width={naturalWidth}
          height={naturalHeight}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}
