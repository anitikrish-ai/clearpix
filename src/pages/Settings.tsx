import { useStore } from '../store/useStore';

export function Settings() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const files = useStore((s) => s.files);
  const clearFiles = useStore((s) => s.clearFiles);

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="subtitle">Appearance, data and license.</p>

      <div className="card">
        <div className="section-title">Appearance</div>
        <div className="row">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button key={t} className="btn" style={theme === t ? { borderColor: 'var(--accent)' } : undefined} onClick={() => setTheme(t)}>
              {t === 'system' ? '🖥️ System' : t === 'light' ? '☀️ Light' : '🌙 Dark'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Your data</div>
        <p className="file-meta">{files.length} file(s) currently loaded in this session, kept only in memory on this device.</p>
        <button className="btn btn-danger" onClick={clearFiles} disabled={files.length === 0}>
          Clear all files
        </button>
      </div>

      <div className="card">
        <div className="section-title">Privacy</div>
        <p className="file-meta">
          All inspection and cleaning runs locally in this app. Files are never uploaded, no account or login is required, and
          nothing is sent to any server unless you explicitly choose to export or share a result yourself.
        </p>
      </div>

      <div className="card">
        <div className="section-title">License</div>
        <p className="file-meta">CLEARPIX is free and open-source software, licensed under Apache-2.0.</p>
      </div>
    </div>
  );
}
