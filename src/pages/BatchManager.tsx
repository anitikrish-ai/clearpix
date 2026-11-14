import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Dropzone } from '../components/Dropzone';
import { PinterestDragTray } from '../components/PinterestDragTray';
import { BatchRunner, type BatchJob } from '../engine/batch/queue';
import { processImage } from '../engine/image/pipeline';
import { processTextFile } from '../engine/text/pipeline';
import { downloadBlob, downloadZip, formatBytes } from '../engine/fileio';

interface BatchResult {
  blob: Blob;
  fileName: string;
  originalSize: number;
  resultSize: number;
  dragName?: string;
}

export function BatchManager() {
  const files = useStore((s) => s.files);
  const addFiles = useStore((s) => s.addFiles);
  const removeFile = useStore((s) => s.removeFile);
  const setImageResult = useStore((s) => s.setImageResult);
  const setTextResult = useStore((s) => s.setTextResult);
  const setStatus = useStore((s) => s.setStatus);

  const [jobs, setJobs] = useState<BatchJob<BatchResult>[]>([]);
  const [runner] = useState(() => new BatchRunner<BatchResult>(undefined, (list) => setJobs(list)));

  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const runOne = (id: string) => {
    const file = files.find((f) => f.id === id);
    if (!file) return;
    setStatus(id, 'processing');
    runner.add(id, async () => {
      if (file.kind === 'image') {
        const result = await processImage(file.file, file.imageSettings);
        setImageResult(id, result);
        const base = file.file.name.replace(/\.[^.]+$/, '');
        const ext = result.format === 'jpeg' ? 'jpg' : result.format;
        return { blob: result.blob, fileName: `${base}.cleaned.${ext}`, dragName: `${base}.${ext}`, originalSize: result.originalSize, resultSize: result.resultSize };
      }
      const result = await processTextFile(file.file, file.textSettings);
      setTextResult(id, result);
      return { blob: result.blob, fileName: result.fileName, originalSize: file.file.size, resultSize: result.blob.size };
    });
  };

  const processAll = () => {
    for (const f of files) {
      const job = jobById.get(f.id);
      if (!job || job.status === 'queued' || job.status === 'error' || job.status === 'canceled') {
        runOne(f.id);
      }
    }
  };

  const dragItems = files.flatMap((f) => {
    const r = jobById.get(f.id)?.result;
    return f.kind === 'image' && r?.dragName && f.resultPreviewUrl ? [{ id: f.id, name: r.dragName, blob: r.blob, url: f.resultPreviewUrl }] : [];
  });

  const doneCount = jobs.filter((j) => j.status === 'done').length;

  const exportZip = async () => {
    const entries = jobs
      .filter((j) => j.status === 'done' && j.result)
      .map((j) => ({ name: j.result!.fileName, blob: j.result!.blob }));
    if (entries.length) await downloadZip(entries);
  };

  return (
    <div className="page">
      <div className="row-between">
        <div>
          <h1>Batch Manager</h1>
          <p className="subtitle">{files.length} file(s) queued · {doneCount} processed</p>
        </div>
        <div className="row">
          <button className="btn" onClick={exportZip} disabled={doneCount === 0}>
            Export ZIP ({doneCount})
          </button>
          <button className="btn btn-primary" onClick={processAll} disabled={files.length === 0}>
            Process all
          </button>
        </div>
      </div>

      <Dropzone onFiles={addFiles} />

      {dragItems.length > 0 && <PinterestDragTray items={dragItems} />}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="file-list">
          {files.map((f) => {
            const job = jobById.get(f.id);
            const status = job?.status ?? f.status;
            return (
              <div key={f.id} className={`file-row`}>
                {f.kind === 'image' ? <img src={f.previewUrl} className="thumb" alt="" /> : <div className="thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄</div>}
                <div>
                  <div className="file-name">{f.file.name}</div>
                  <div className="file-meta">
                    {f.kind} · {formatBytes(f.file.size)}
                    {job?.result ? ` → ${formatBytes(job.result.resultSize)}` : ''}
                  </div>
                </div>
                <span className={`status-pill status-${status}`}>{job?.error ? 'error' : status}</span>
                <div className="row">
                  {status === 'processing' ? (
                    <button className="btn" onClick={() => runner.cancel(f.id)}>
                      Cancel
                    </button>
                  ) : status === 'error' || status === 'canceled' ? (
                    <button className="btn" onClick={() => runOne(f.id)}>
                      Retry
                    </button>
                  ) : job?.status === 'done' ? (
                    <button className="btn" onClick={() => downloadBlob(job.result!.blob, job.result!.fileName)}>
                      Download
                    </button>
                  ) : (
                    <button className="btn" onClick={() => runOne(f.id)}>
                      Process
                    </button>
                  )}
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    runner.remove(f.id);
                    removeFile(f.id);
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        {files.length === 0 && <div className="empty-state">No files yet. Drop files or folders above.</div>}
      </div>
    </div>
  );
}
