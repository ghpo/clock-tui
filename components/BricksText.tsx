'use client';

import { useMemo } from 'react';
import { expandCharCells, CHARACTER_SPACING, getGlyphColumns, getGlyphRows, FONT } from '@/lib/bricks';

interface BricksCharProps {
  char: string;
  size: number;
  color: string;
}

const BRICK_PX = FONT.defaultScale;

function BricksChar({ char, size, color }: BricksCharProps) {
  const cells = useMemo(() => expandCharCells(char), [char]);
  if (!cells) return null;

  const px = size * BRICK_PX;
  const cols = getGlyphColumns();
  const rows = getGlyphRows();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${px}px)`,
        gridTemplateRows: `repeat(${rows}, ${px}px)`,
        gap: 0,
      }}
    >
      {cells.map((cell, idx) => (
        <div
          key={idx}
          style={{
            width: px,
            height: px,
            backgroundColor: cell.on ? color : 'transparent',
            borderRadius: px * 0.2,
          }}
        />
      ))}
    </div>
  );
}

interface BricksTextProps {
  text: string;
  size?: number;
  color?: string;
}

export default function BricksText({ text, size = 1, color = '#00ff00' }: BricksTextProps) {
  const chars = useMemo(() => text.split(''), [text]);
  const px = size * BRICK_PX;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
      {chars.map((ch, i) => (
        <div key={i} style={{ marginRight: i < chars.length - 1 ? CHARACTER_SPACING * px : 0 }}>
          <BricksChar char={ch} size={size} color={color} />
        </div>
      ))}
    </div>
  );
}
