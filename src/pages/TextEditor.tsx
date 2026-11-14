import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Dropzone } from '../components/Dropzone';
import { loadTextFile, processTextFile, type TextLoadResult } from '../engine/text/pipeline';
import { diffTextWords } from '../engine/text/diff';
import { downloadBlob } from '../engine/fileio';
import type { CleanTextOptions } from '../engine/text/unicode';

export function TextEditor() {
  const files = useStore((s) => s.files);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const addFiles = useStore((s) => s.addFiles);
  const navigate = useNavigate();

  const textFiles = useMemo(() => files.filter((f) => f.kind === 'text'), [files]);
  const current = files.find((f) => f.id === selectedId && f.kind === 'text') ?? textFiles[0];

  const [loaded, setLoaded] = useState<TextLoadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanOpts, setCleanOpts] = useState<CleanTextOptions>({
    removeZeroWidth: true,
    removeBidiControl: true,
    removeVariationSelectors: false,
    removeUnicodeTags: false,
    normalizeWhitespace: false,
    unicodeNormalForm: 'none',
  });
  const [cleanedText, setCleanedText] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<{ blob: Blob; fileName: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!selectedId && textFiles[0]) select(textFiles[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoaded(null);
    setCleanedText(null);
    setResultBlob(null);
    if (!current) return;
    setLoading(true);
    loadTextFile(current.file)
      .then(setLoaded)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) {
    return (
      <div className="page">
        <h1>Text Editor</h1>
        <p className="subtitle">No text file selected yet. Drop one to start.</p>
        <Dropzone accept=".txt,.md,.html,.htm,.docx,.csv,.json" onFiles={addFiles} />
      </div>
    );
  }

  const runClean = async () => {
    setProcessing(true);
    try {
      const result = await processTextFile(current.file, { clean: cleanOpts, html: { stripStyleAttributes: true, stripComments: true } });
      setCleanedText(result.cleanedText);
      setResultBlob({ blob: result.blob, fileName: result.fileName });
    } finally {
      setProcessing(false);
    }
  };

  const diffParts = cleanedText !== null && loaded ? diffTextWords(loaded.displayText, cleanedText) : null;

  return (
    <div className="page">
      <div className="row-between">
        <div>
          <h1>Text Editor</h1>
          <p className="subtitle">{current.file.name}</p>
        </div>
        {textFiles.length > 1 && (
          <select value={current.id} onChange={(e) => select(e.target.value)}>
            {textFiles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.file.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="editor-layout">
        <div>
          {loading && <p className="file-meta">Reading file…</p>}

          {loaded && (
            <div className="card">
              <div className="section-title">Inspection</div>
              <div className="row" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
                <span className="pill">Zero-width: {loaded.inspection.counts['zero-width']}</span>
                <span className="pill">Bidi control: {loaded.inspection.counts['bidi-control']}</span>
                <span className="pill">Variation selectors: {loaded.inspection.counts['variation-selector']}</span>
                <span className="pill">Unicode tags: {loaded.inspection.counts['unicode-tag']}</span>
                <span className="pill">Unusual whitespace: {loaded.inspection.counts['unusual-whitespace']}</span>
              </div>
              {loaded.inspection.aiWatermarkIndicator && (
                <p className="file-meta">
                  Variation-selector or Unicode-tag characters were found. These are a documented technique sometimes used to embed
                  hidden markers (including AI-content watermarks) in plain text — this is a signal to review, not a certainty.
                </p>
              )}
              {loaded.inspection.findings.length > 0 ? (
                <div className="scroll-y" style={{ maxHeight: 220 }}>
                  <table className="metadata-table">
                    <thead>
                      <tr>
                        <th>Index</th>
                        <th>Character</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loaded.inspection.findings.slice(0, 200).map((f, i) => (
                        <tr key={i}>
                          <td>{f.index}</td>
                          <td>
                            <code className="char-code">{f.hex}</code> {f.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="file-meta">No invisible/unusual characters found.</p>
              )}

              {loaded.metadata.length > 0 && (
                <>
                  <div className="section-title" style={{ marginTop: 14 }}>
                    Embedded metadata
                  </div>
                  <table className="metadata-table">
                    <tbody>
                      {loaded.metadata.map((m, i) => (
                        <tr key={i}>
                          <th>{m.key}</th>
                          <td>{m.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}

          {diffParts && (
            <div className="card">
              <div className="section-title">Before / after difference</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'ui-monospace, monospace', maxHeight: 320, overflowY: 'auto' }}>
                {diffParts.map((part, i) => (
                  <span key={i} className={part.added ? 'diff-added' : part.removed ? 'diff-removed' : undefined}>
                    {part.value}
                  </span>
                ))}
              </div>
              {resultBlob && (
                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => downloadBlob(resultBlob.blob, resultBlob.fileName)}>
                  Download cleaned file
                </button>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="card">
            <div className="section-title">Clean characters</div>
            {([
              ['removeZeroWidth', 'Remove zero-width characters'],
              ['removeBidiControl', 'Remove bidi control characters'],
              ['removeVariationSelectors', 'Remove variation selectors'],
              ['removeUnicodeTags', 'Remove Unicode tag characters'],
              ['normalizeWhitespace', 'Normalize whitespace'],
            ] as [keyof CleanTextOptions, string][]).map(([key, label]) => (
              <label key={key} className="row" style={{ fontSize: 13, fontWeight: 400, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={Boolean(cleanOpts[key])}
                  onChange={(e) => setCleanOpts((c) => ({ ...c, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
            <label className="field" style={{ marginTop: 8 }}>
              Unicode normalization form
              <select
                value={cleanOpts.unicodeNormalForm}
                onChange={(e) => setCleanOpts((c) => ({ ...c, unicodeNormalForm: e.target.value as CleanTextOptions['unicodeNormalForm'] }))}
              >
                <option value="none">None</option>
                <option value="NFC">NFC</option>
                <option value="NFD">NFD</option>
                <option value="NFKC">NFKC</option>
                <option value="NFKD">NFKD</option>
              </select>
            </label>
            <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={processing || loading} onClick={runClean}>
              {processing ? 'Cleaning…' : 'Clean & compare'}
            </button>
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
