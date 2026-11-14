import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ImageCanvasEditor, type EditTool } from '../components/ImageCanvasEditor';
import { CompareSlider } from '../components/CompareSlider';
import { readMetadata } from '../engine/image/metadata';
import { processImage } from '../engine/image/pipeline';
import type { MetadataReport, Rect } from '../engine/image/types';
import { downloadBlob, formatBytes } from '../engine/fileio';
import { Dropzone } from '../components/Dropzone';

const TOOLS: { id: EditTool; label: string; icon: string }[] = [
  { id: 'pan', label: 'Pan / Zoom', icon: '✋' },
  { id: 'crop', label: 'Crop', icon: '⬛' },
  { id: 'redact', label: 'Redact', icon: '◼' },
  { id: 'blur', label: 'Blur', icon: '🌫️' },
  { id: 'brush', label: 'Brush (inpaint)', icon: '🖌️' },
];

export function ImageEditor() {
  const files = useStore((s) => s.files);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const addFiles = useStore((s) => s.addFiles);
  const setImageResult = useStore((s) => s.setImageResult);
  const setStatus = useStore((s) => s.setStatus);
  const navigate = useNavigate();

  const imageFiles = useMemo(() => files.filter((f) => f.kind === 'image'), [files]);
  const current = files.find((f) => f.id === selectedId && f.kind === 'image') ?? imageFiles[0];

  const [tool, setTool] = useState<EditTool>('pan');
  const [brushSize, setBrushSize] = useState(32);
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [redactRects, setRedactRects] = useState<Rect[]>([]);
  const [blurRects, setBlurRects] = useState<Rect[]>([]);
  const [showMask, setShowMask] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [metadata, setMetadata] = useState<MetadataReport | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<string>('');
  const [resizeHeight, setResizeHeight] = useState<string>('');
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [format, setFormat] = useState<'original' | 'png' | 'jpeg' | 'webp'>('original');
  const [quality, setQuality] = useState(0.92);
  const [enhancePreview, setEnhancePreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!selectedId && imageFiles[0]) select(imageFiles[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCropRect(null);
    setRedactRects([]);
    setBlurRects([]);
    maskCanvasRef.current = null;
    setMetadata(null);
    if (!current) return;
    const img = new Image();
    img.onload = () => setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = current.previewUrl;
    setLoadingMeta(true);
    readMetadata(current.file)
      .then(setMetadata)
      .finally(() => setLoadingMeta(false));
    // Intentionally keyed only on the file id: re-running on every store update would
    // reset in-progress selections whenever an unrelated field (e.g. status) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) {
    return (
      <div className="page">
        <h1>Image Editor</h1>
        <p className="subtitle">No image selected yet. Drop one to start.</p>
        <Dropzone
          accept="image/*"
          onFiles={(fs) => {
            addFiles(fs);
          }}
        />
      </div>
    );
  }

  const apply = async () => {
    setApplying(true);
    setStatus(current.id, 'processing');
    try {
      const hasMask = showMask && maskCanvasRef.current && tool === 'brush';
      const resolvedFormat = format === 'original' ? undefined : format;
      const result = await processImage(current.file, {
        crop: cropRect ?? undefined,
        redactRegions: redactRects,
        blurRegions: blurRects,
        inpaintMask: hasMask ? maskCanvasRef.current!.toDataURL('image/png') : undefined,
        resize:
          resizeWidth || resizeHeight
            ? { width: resizeWidth ? Number(resizeWidth) : undefined, height: resizeHeight ? Number(resizeHeight) : undefined, maintainAspect }
            : undefined,
        export: resolvedFormat ? { format: resolvedFormat, quality } : { format: current.imageSettings.export?.format ?? ('jpeg' as const), quality },
      });
      setImageResult(current.id, result);
    } catch (err) {
      setStatus(current.id, 'error', err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  };

  const download = () => {
    if (!current.imageResult) return;
    const base = current.file.name.replace(/\.[^.]+$/, '');
    const ext = current.imageResult.format === 'jpeg' ? 'jpg' : current.imageResult.format;
    downloadBlob(current.imageResult.blob, `${base}.cleaned.${ext}`);
  };

  return (
    <div className="page">
      <div className="row-between">
        <div>
          <h1>Image Editor</h1>
          <p className="subtitle">{current.file.name}</p>
        </div>
        {imageFiles.length > 1 && (
          <select value={current.id} onChange={(e) => select(e.target.value)}>
            {imageFiles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.file.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="editor-layout">
        <div>
          <div className="toolbar card" style={{ marginBottom: 12 }}>
            {TOOLS.map((t) => (
              <button key={t.id} className="btn" style={tool === t.id ? { background: 'var(--accent)', color: 'var(--accent-contrast)', borderColor: 'var(--accent)' } : undefined} onClick={() => setTool(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
            {tool === 'brush' && (
              <>
                <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  Brush size
                  <input type="range" min={6} max={120} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} />
                </label>
                <button className="btn" onClick={() => setShowMask((s) => !s)}>{showMask ? 'Hide mask' : 'Show mask'}</button>
              </>
            )}
            {(cropRect || redactRects.length || blurRects.length) && (
              <button
                className="btn btn-danger"
                onClick={() => {
                  setCropRect(null);
                  setRedactRects([]);
                  setBlurRects([]);
                }}
              >
                Clear selections
              </button>
            )}
          </div>

          <div className="canvas-stage">
            {naturalSize.width > 0 && (
              <ImageCanvasEditor
                src={enhancePreview ? current.previewUrl : current.previewUrl}
                naturalWidth={naturalSize.width}
                naturalHeight={naturalSize.height}
                tool={tool}
                brushSize={brushSize}
                cropRect={cropRect}
                onCropChange={setCropRect}
                redactRects={redactRects}
                onRedactRectsChange={setRedactRects}
                blurRects={blurRects}
                onBlurRectsChange={setBlurRects}
                maskCanvasRef={maskCanvasRef}
                showMask={showMask && tool === 'brush'}
              />
            )}
          </div>
          <p className="file-meta" style={{ marginTop: 8 }}>
            Scroll to zoom · drag to draw (or pan in Pan mode). Brush strokes mark the area to reconstruct with inpainting.
          </p>

          {current.imageResult && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="section-title">Before / After</div>
              <CompareSlider beforeSrc={current.previewUrl} afterSrc={current.resultPreviewUrl!} />
              <p className="file-meta" style={{ marginTop: 10 }}>
                {formatBytes(current.imageResult.originalSize)} → {formatBytes(current.imageResult.resultSize)} · {current.imageResult.width}×{current.imageResult.height} · {current.imageResult.format.toUpperCase()}
              </p>
              <button className="btn btn-primary" onClick={download}>
                Download result
              </button>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="card">
            <div className="section-title">Spot overlays</div>
            <label className="row" style={{ fontSize: 13, fontWeight: 400 }}>
              <input type="checkbox" checked={enhancePreview} onChange={(e) => setEnhancePreview(e.target.checked)} />
              Contrast-enhanced preview (visual aid only)
            </label>
          </div>

          <div className="card">
            <div className="section-title">Resize</div>
            <div className="grid-2">
              <label className="field">
                Width (px)
                <input type="number" value={resizeWidth} onChange={(e) => setResizeWidth(e.target.value)} placeholder={String(naturalSize.width)} />
              </label>
              <label className="field">
                Height (px)
                <input type="number" value={resizeHeight} onChange={(e) => setResizeHeight(e.target.value)} placeholder={String(naturalSize.height)} />
              </label>
            </div>
            <label className="row" style={{ marginTop: 8, fontSize: 13, fontWeight: 400 }}>
              <input type="checkbox" checked={maintainAspect} onChange={(e) => setMaintainAspect(e.target.checked)} />
              Maintain aspect ratio
            </label>
          </div>

          <div className="card">
            <div className="section-title">Export</div>
            <label className="field">
              Format
              <select value={format} onChange={(e) => setFormat(e.target.value as any)}>
                <option value="original">Keep original</option>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WEBP</option>
              </select>
            </label>
            {format !== 'png' && (
              <label className="field" style={{ marginTop: 8 }}>
                Quality: {Math.round(quality * 100)}%
                <input type="range" min={0.3} max={1} step={0.01} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
              </label>
            )}
            <p className="file-meta" style={{ marginTop: 8 }}>
              Exporting re-encodes the pixel data, which removes EXIF/XMP/IPTC metadata as a side effect. Your original file is never modified.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 6 }} disabled={applying} onClick={apply}>
              {applying ? 'Processing…' : 'Apply & export'}
            </button>
          </div>

          <div className="card">
            <div className="section-title">Metadata</div>
            {loadingMeta && <p className="file-meta">Reading…</p>}
            {metadata && (
              <>
                <p className="file-meta">{metadata.hasAnyMetadata ? `${metadata.entries.length} tag(s) found` : 'No EXIF/XMP/IPTC metadata found'}</p>
                {metadata.entries.length > 0 && (
                  <table className="metadata-table">
                    <tbody>
                      {metadata.entries.slice(0, 40).map((e, i) => (
                        <tr key={i}>
                          <th>
                            {e.group}:{e.key}
                          </th>
                          <td>{e.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {metadata.provenance.length > 0 && (
                  <>
                    <div className="section-title" style={{ marginTop: 14 }}>
                      Provenance signals
                    </div>
                    {metadata.provenance.map((p, i) => (
                      <p key={i} className="file-meta">
                        <span className="pill">{p.label}</span>
                        {p.detail}
                      </p>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <button className="btn" onClick={() => navigate('/workspace')}>
          ← Back to Workspace
        </button>
      </div>
    </div>
  );
}
