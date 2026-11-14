import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { useStore } from '../store/useStore';
import { formatBytes } from '../engine/fileio';

export function Workspace() {
  const files = useStore((s) => s.files);
  const addFiles = useStore((s) => s.addFiles);
  const removeFile = useStore((s) => s.removeFile);
  const select = useStore((s) => s.select);
  const selectedId = useStore((s) => s.selectedId);
  const navigate = useNavigate();

  const openFile = (id: string, kind: 'image' | 'text') => {
    select(id);
    navigate(kind === 'image' ? '/image-editor' : '/text-editor');
  };

  return (
    <div className="page">
      <h1>Workspace</h1>
      <p className="subtitle">{files.length} file{files.length === 1 ? '' : 's'} loaded. Everything stays on this device.</p>

      <Dropzone onFiles={addFiles} />

      {files.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="file-list">
            {files.map((f) => (
              <div key={f.id} className={`file-row${selectedId === f.id ? ' selected' : ''}`}>
                {f.kind === 'image' ? (
                  <img src={f.previewUrl} className="thumb" alt="" />
                ) : (
                  <div className="thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📄</div>
                )}
                <div>
                  <div className="file-name">{f.file.name}</div>
                  <div className="file-meta">
                    {f.kind} · {formatBytes(f.file.size)}
                  </div>
                </div>
                <span className={`status-pill status-${f.status}`}>{f.status}</span>
                <button className="btn" onClick={() => openFile(f.id, f.kind)}>
                  Open
                </button>
                <button className="btn btn-danger" onClick={() => removeFile(f.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length === 0 && (
        <div className="empty-state">No files yet. Drop some above to get started.</div>
      )}
    </div>
  );
}
