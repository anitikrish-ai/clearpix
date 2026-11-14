import { NavLink } from 'react-router-dom';
import { useStore } from '../store/useStore';

const LINKS = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/workspace', label: 'Workspace', icon: '🗂️' },
  { to: '/image-editor', label: 'Image Editor', icon: '🖼️' },
  { to: '/text-editor', label: 'Text Editor', icon: '📝' },
  { to: '/batch', label: 'Batch Manager', icon: '📦' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Sidebar() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <aside className="sidebar glass">
      <div className="brand">
        CLEARPIX
        <small>Local-first inspection &amp; cleaning</small>
      </div>
      {LINKS.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <span>{l.icon}</span>
          <span>{l.label}</span>
        </NavLink>
      ))}
      <div className="sidebar-footer">
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>v0.1 · Apache-2.0</span>
        <button
          className="btn"
          title="Toggle theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
        >
          {theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🖥️'}
        </button>
      </div>
    </aside>
  );
}
