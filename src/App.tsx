import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { useStore } from './store/useStore';
import { Home } from './pages/Home';

const Workspace = lazy(() => import('./pages/Workspace').then((m) => ({ default: m.Workspace })));
const ImageEditor = lazy(() => import('./pages/ImageEditor').then((m) => ({ default: m.ImageEditor })));
const TextEditor = lazy(() => import('./pages/TextEditor').then((m) => ({ default: m.TextEditor })));
const BatchManager = lazy(() => import('./pages/BatchManager').then((m) => ({ default: m.BatchManager })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));

export default function App() {
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <Suspense fallback={<div className="page">Loading…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/image-editor" element={<ImageEditor />} />
            <Route path="/text-editor" element={<TextEditor />} />
            <Route path="/batch" element={<BatchManager />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
