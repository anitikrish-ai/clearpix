import { useNavigate } from 'react-router-dom';
import { Dropzone } from '../components/Dropzone';
import { useStore } from '../store/useStore';

const CARDS = [
  { to: '/workspace', icon: '🗂️', title: 'Workspace', desc: 'Add files, see detected type and status, jump into an editor.' },
  { to: '/image-editor', icon: '🖼️', title: 'Image Editor', desc: 'Inspect EXIF/XMP/IPTC, crop, blur, redact, inpaint overlays, resize & convert.' },
  { to: '/text-editor', icon: '📝', title: 'Text Editor', desc: 'Find invisible Unicode characters, normalize, clean HTML, diff before/after.' },
  { to: '/batch', icon: '📦', title: 'Batch Manager', desc: 'Queue many files, process concurrently, export everything as a ZIP.' },
];

export function Home() {
  const navigate = useNavigate();
  const addFiles = useStore((s) => s.addFiles);

  return (
    <div className="page">
      <h1>CLEARPIX</h1>
      <p className="subtitle">Local-first image &amp; text inspection and cleaning. Nothing leaves your device.</p>

      <Dropzone
        onFiles={(files) => {
          addFiles(files);
          navigate('/workspace');
        }}
      />

      <div className="home-grid">
        {CARDS.map((c) => (
          <a key={c.to} className="home-card" onClick={(e) => { e.preventDefault(); navigate(c.to); }} href={c.to}>
            <div className="icon-badge">{c.icon}</div>
            <h3>{c.title}</h3>
            <p>{c.desc}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
