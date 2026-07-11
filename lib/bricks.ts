export const FONT = {
  name: 'Bricks',
  glyphWidth: 9,
  glyphHeight: 9,
  characterSpacing: 1,
  lineSpacing: 2,
  defaultScale: 8,
} as const;

const DIGITS: Record<string, string[]> = {
  '0': [
    '011111110',
    '111111111',
    '110000011',
    '110000011',
    '110000011',
    '110000011',
    '110000011',
    '111111111',
    '011111110',
  ],
  '1': [
    '000111000',
    '001111000',
    '000011000',
    '000011000',
    '000011000',
    '000011000',
    '000011000',
    '000011000',
    '001111110',
  ],
  '2': [
    '011111110',
    '111111111',
    '110000011',
    '000000011',
    '000000011',
    '011111110',
    '110000000',
    '111111111',
    '111111111',
  ],
  '3': [
    '011111110',
    '111111111',
    '110000011',
    '000000011',
    '001111110',
    '000000011',
    '110000011',
    '111111111',
    '011111110',
  ],
  '4': [
    '110000011',
    '110000011',
    '110000011',
    '110000011',
    '011111111',
    '000000011',
    '000000011',
    '000000011',
    '000000011',
  ],
  '5': [
    '111111111',
    '111111111',
    '110000000',
    '110000000',
    '011111110',
    '000000011',
    '110000011',
    '111111111',
    '011111110',
  ],
  '6': [
    '011111110',
    '111111111',
    '110000011',
    '110000000',
    '111111110',
    '110000011',
    '110000011',
    '111111111',
    '011111110',
  ],
  '7': [
    '111111111',
    '111111111',
    '000000011',
    '000000110',
    '000001100',
    '000011000',
    '000110000',
    '000110000',
    '000110000',
  ],
  '8': [
    '011111110',
    '111111111',
    '110000011',
    '110000011',
    '011111110',
    '110000011',
    '110000011',
    '111111111',
    '011111110',
  ],
  '9': [
    '011111110',
    '111111111',
    '110000011',
    '110000011',
    '011111111',
    '000000011',
    '110000011',
    '111111111',
    '011111110',
  ],
  ':': [
    '000000000',
    '000111000',
    '000111000',
    '000000000',
    '000000000',
    '000000000',
    '000111000',
    '000111000',
    '000000000',
  ],
};

export interface BricksCell {
  on: boolean;
  row: number;
  col: number;
}

export function getCharMatrix(c: string): string[] | null {
  const glyph = DIGITS[c] || null;
  if (glyph) return glyph;

  if (c === ' ') {
    return Array(FONT.glyphHeight).fill('0'.repeat(FONT.glyphWidth));
  }

  return null;
}

export function getGlyphColumns(): number {
  return FONT.glyphWidth;
}

export function getGlyphRows(): number {
  return FONT.glyphHeight;
}

export function expandCharCells(c: string): BricksCell[] | null {
  const matrix = getCharMatrix(c);
  if (!matrix) return null;

  const cells: BricksCell[] = [];
  for (let row = 0; row < FONT.glyphHeight; row++) {
    const line = matrix[row] || '';
    for (let col = 0; col < FONT.glyphWidth; col++) {
      const ch = col < line.length ? line[col] : '0';
      cells.push({ on: ch === '1', row, col });
    }
  }
  return cells;
}

export const CHARACTER_SPACING = FONT.characterSpacing;
