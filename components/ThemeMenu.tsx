'use client';

import { useState, useRef, useEffect } from 'react';
import { themes } from '@/lib/themes';

interface ThemeMenuProps {
  currentIndex: number;
  onThemeChange: (index: number) => void;
}

export default function ThemeMenu({ currentIndex, onThemeChange }: ThemeMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const click = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handle);
    window.addEventListener('mousedown', click);
    return () => {
      window.removeEventListener('keydown', handle);
      window.removeEventListener('mousedown', click);
    };
  }, [open]);

  const currentTheme = themes[currentIndex] || themes[0];

  return (
    <div ref={menuRef} className="theme-menu-container" style={{ position: 'relative' }}>
      {/* Hamburger button */}
      <button
        className="theme-hamburger"
        onClick={() => setOpen(!open)}
        aria-label="Switch theme"
        title={`Theme: ${currentTheme.label}`}
        style={{
          background: 'transparent',
          border: '1px solid var(--fg-dim)',
          borderRadius: '4px',
          color: 'var(--fg)',
          cursor: 'pointer',
          fontSize: '18px',
          width: '36px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1,
          transition: 'opacity 0.15s',
        }}
      >
        ☰
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="theme-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            background: 'var(--bg)',
            border: '1px solid var(--fg-dim)',
            borderRadius: '4px',
            minWidth: '180px',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--muted)',
              borderBottom: '1px solid var(--fg-dim)',
            }}
          >
            Themes
          </div>
          {themes.map((theme, idx) => {
            const clockColor = theme.css['--clock-color'] || '#00ff00';
            const isActive = idx === currentIndex;
            return (
              <button
                key={theme.name}
                onClick={() => {
                  onThemeChange(idx);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 10px',
                  background: isActive ? 'var(--fg-dim)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--fg-dim)',
                  color: isActive ? clockColor : 'var(--fg)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--fg-dim)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                {/* Color preview */}
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: clockColor,
                    border: `1px solid ${isActive ? clockColor : 'var(--fg-dim)'}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{theme.label}</span>
                {isActive && <span style={{ fontSize: '11px', opacity: 0.7 }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
