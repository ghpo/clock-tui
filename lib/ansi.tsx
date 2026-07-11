'use client';

// Parses ANSI SGR escape sequences and returns HTML-like style objects
interface StyleSpan {
  text: string;
  style: React.CSSProperties;
}

interface AnsiStyle {
  fg?: string;
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const ANSI_COLORS: Record<number, string> = {
  0: '#000000', 1: '#800000', 2: '#008000', 3: '#808000',
  4: '#000080', 5: '#800080', 6: '#008080', 7: '#c0c0c0',
  8: '#808080', 9: '#ff0000', 10: '#00ff00', 11: '#ffff00',
  12: '#0000ff', 13: '#ff00ff', 14: '#00ffff', 15: '#ffffff',
};

function ansiColor(code: number, base: number): string {
  if (code >= 30 && code <= 37) return ANSI_COLORS[code - 30] || '#ffffff';
  if (code >= 40 && code <= 47) return ANSI_COLORS[code - 40] || '#000000';
  if (code >= 90 && code <= 97) return ANSI_COLORS[code - 90 + 8] || '#ffffff';
  if (code >= 100 && code <= 107) return ANSI_COLORS[code - 100 + 8] || '#000000';
  return base === 30 ? '#ffffff' : '#000000';
}

export function parseAnsi(text: string): StyleSpan[] {
  const segments: StyleSpan[] = [];
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let current: AnsiStyle = {};

  const pushText = (t: string) => {
    if (!t) return;
    const style: React.CSSProperties = {};
    if (current.fg) style.color = current.fg;
    if (current.bg) style.backgroundColor = current.bg;
    if (current.bold) style.fontWeight = 'bold';
    if (current.dim) style.opacity = 0.5;
    if (current.italic) style.fontStyle = 'italic';
    if (current.underline) style.textDecoration = 'underline';
    segments.push({ text: t, style });
  };

  let match: RegExpExecArray | null;
  while ((match = ansiRegex.exec(text)) !== null) {
    pushText(text.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    const codes = match[1] ? match[1].split(';').map(Number) : [0];
    let i = 0;
    while (i < codes.length) {
      const code = codes[i];
      switch (code) {
        case 0: current = {}; break;
        case 1: current.bold = true; break;
        case 2: current.dim = true; break;
        case 3: current.italic = true; break;
        case 4: current.underline = true; break;
        case 22: current.bold = false; current.dim = false; break;
        case 23: current.italic = false; break;
        case 24: current.underline = false; break;
        case 38: // foreground 256/truecolor
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            current.fg = ANSI_COLORS[codes[i + 2]] || '#ffffff';
            i += 2;
          } else if (codes[i + 1] === 2 && codes[i + 2] !== undefined && codes[i + 3] !== undefined && codes[i + 4] !== undefined) {
            current.fg = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
            i += 4;
          }
          break;
        case 48: // background 256/truecolor
          if (codes[i + 1] === 5 && codes[i + 2] !== undefined) {
            current.bg = ANSI_COLORS[codes[i + 2]] || '#000000';
            i += 2;
          } else if (codes[i + 1] === 2 && codes[i + 2] !== undefined && codes[i + 3] !== undefined && codes[i + 4] !== undefined) {
            current.bg = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`;
            i += 4;
          }
          break;
        case 39: current.fg = undefined; break;
        case 49: current.bg = undefined; break;
        default:
          if (code >= 30 && code <= 37) current.fg = ansiColor(code, 30);
          else if (code >= 90 && code <= 97) current.fg = ansiColor(code, 90);
          else if (code >= 40 && code <= 47) current.bg = ansiColor(code, 40);
          else if (code >= 100 && code <= 107) current.bg = ansiColor(code, 100);
          break;
      }
      i++;
    }
  }

  pushText(text.slice(lastIndex));
  return segments;
}

// Strip all ANSI escape codes for plain text fallback
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// Render ANSI text as React spans
export function AnsiText({ text }: { text: string }) {
  const segments = parseAnsi(text);
  return (
    <>
      {segments.map((seg, i) =>
        Object.keys(seg.style).length > 0 ? (
          <span key={i} style={seg.style}>{seg.text}</span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
