import { useRef, useState } from 'react';

interface Props {
  beforeSrc: string;
  afterSrc: string;
  alt?: string;
}

/** Interactive before/after image comparison with a draggable divider. */
export function CompareSlider({ beforeSrc, afterSrc, alt }: Props) {
  const [pct, setPct] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    setPct(ratio * 100);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', maxWidth: 720, userSelect: 'none', borderRadius: 12, overflow: 'hidden' }}
      onMouseDown={(e) => {
        dragging.current = true;
        updateFromClientX(e.clientX);
      }}
      onMouseMove={(e) => {
        if (dragging.current) updateFromClientX(e.clientX);
      }}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchStart={(e) => updateFromClientX(e.touches[0].clientX)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      <img src={afterSrc} alt={alt ?? 'after'} style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${pct}%` }}>
        <img src={beforeSrc} alt={alt ?? 'before'} style={{ display: 'block', width: `${(100 / pct) * 100 || 100}%`, maxWidth: 'none', height: 'auto' }} draggable={false} />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `calc(${pct}% - 1px)`,
          width: 2,
          background: 'var(--accent)',
          cursor: 'ew-resize',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${pct}%`,
          transform: 'translate(-50%, -50%)',
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--accent)',
          color: 'var(--accent-contrast)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          cursor: 'ew-resize',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        ⇔
      </div>
      <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 11, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '2px 7px', borderRadius: 6 }}>Before</span>
      <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 11, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '2px 7px', borderRadius: 6 }}>After</span>
    </div>
  );
}
