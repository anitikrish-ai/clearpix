import { useState } from 'react';

export interface DragItem {
  id: string;
  name: string;
  blob: Blob;
  url: string;
}

function startGhost(e: React.DragEvent, count: number) {
  const img = (e.currentTarget as HTMLElement).querySelector('img');
  const ghost = document.createElement('div');
  ghost.style.cssText = 'position:fixed;top:-1000px;left:0;width:72px;height:72px;border-radius:10px;overflow:hidden;background:#888;box-shadow:0 4px 16px rgba(0,0,0,.35)';
  if (img) {
    const clone = img.cloneNode() as HTMLImageElement;
    clone.style.cssText = 'width:100%;height:100%;object-fit:cover';
    ghost.appendChild(clone);
  }
  if (count > 1) {
    const badge = document.createElement('span');
    badge.textContent = String(count);
    badge.style.cssText = 'position:absolute;top:4px;right:4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#0a84ff;color:#fff;font:600 12px/22px system-ui,sans-serif;text-align:center';
    ghost.appendChild(badge);
  }
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 36, 36);
  setTimeout(() => ghost.remove(), 0);
}

/**
 * Multi-select tray of processed images. Dragging any selected thumbnail puts every selected
 * image on the native drag as real File objects (original bytes + filename), so it can be
 * dropped straight into another site's upload area, e.g. Pinterest.
 */
export function PinterestDragTray({ items }: { items: DragItem[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [unsupported, setUnsupported] = useState(false);
  const selected = items.filter((i) => sel.has(i.id));

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onDragStart = (e: React.DragEvent, id: string) => {
    const group = sel.has(id) ? selected : items.filter((i) => i.id === id);
    try {
      e.dataTransfer.effectAllowed = 'copy';
      for (const it of group) {
        e.dataTransfer.items.add(new File([it.blob], it.name, { type: it.blob.type, lastModified: Date.now() }));
      }
      startGhost(e, group.length);
      setUnsupported(false);
    } catch {
      setUnsupported(true);
    }
  };

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row-between">
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>Drag to Pinterest</h2>
          <p className="file-meta" style={{ margin: '4px 0 0' }}>
            Select images, then drag any selected one into Pinterest's upload area (open Pinterest in a window beside this one).
          </p>
        </div>
        <div className="row">
          <span className="file-meta">{selected.length} / {items.length} selected</span>
          <button className="btn" onClick={() => setSel(new Set(items.map((i) => i.id)))} disabled={selected.length === items.length}>
            Select all
          </button>
          <button className="btn" onClick={() => setSel(new Set())} disabled={selected.length === 0}>
            Deselect
          </button>
        </div>
      </div>
      {unsupported && <p className="file-meta" style={{ color: 'var(--danger)' }}>This browser does not allow dragging files out of a page. Use Chrome, Edge or the desktop app.</p>}
      <div className="drag-grid">
        {items.map((it) => {
          const on = sel.has(it.id);
          return (
            <div
              key={it.id}
              className={`drag-item${on ? ' on' : ''}`}
              draggable
              role="checkbox"
              aria-checked={on}
              aria-label={it.name}
              tabIndex={0}
              title={it.name}
              onClick={() => toggle(it.id)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  toggle(it.id);
                }
              }}
              onDragStart={(e) => onDragStart(e, it.id)}
            >
              <img src={it.url} alt="" draggable={false} />
              <span className="drag-check">{on ? '✓' : ''}</span>
              <span className="drag-name">{it.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
