export type CharMatrix = [number[], number[], number[], number[], number[]];

const GLYPH_COLUMNS = 6;
const GLYPH_ROWS = 5;

/**
 * Each row is an array of numbers where:
 *   odd-indexed items = length of "off" segments
 *   even-indexed items = length of "on" segments
 * Example: vec![0, 6] => "██████"
 *          vec![2, 2] => "  ██"
 */
export function getCharMatrix(c: string): CharMatrix | null {
  switch (c) {
    case '0':
      return [[0, 6], [0, 2, 2, 2], [0, 2, 2, 2], [0, 2, 2, 2], [0, 6]];
    case '1':
      return [[0, 4], [2, 2], [2, 2], [2, 2], [0, 6]];
    case '2':
      return [[0, 6], [4, 2], [0, 6], [0, 2], [0, 6]];
    case '3':
      return [[0, 6], [4, 2], [0, 6], [4, 2], [0, 6]];
    case '4':
      return [[0, 2, 2, 2], [0, 2, 2, 2], [0, 6], [4, 2], [4, 2]];
    case '5':
      return [[0, 6], [0, 2], [0, 6], [4, 2], [0, 6]];
    case '6':
      return [[0, 6], [0, 2], [0, 6], [0, 2, 2, 2], [0, 6]];
    case '7':
      return [[0, 6], [4, 2], [4, 2], [4, 2], [4, 2]];
    case '8':
      return [[0, 6], [0, 2, 2, 2], [0, 6], [0, 2, 2, 2], [0, 6]];
    case '9':
      return [[0, 6], [0, 2, 2, 2], [0, 6], [4, 2], [0, 6]];
    case ':':
      return [[], [2, 2], [], [2, 2], []];
    case '.':
      return [[], [], [], [], [2, 2]];
    case '-':
      return [[], [], [0, 6], [], []];
    default:
      return null;
  }
}

export function getGlyphColumns() {
  return GLYPH_COLUMNS;
}

export function getGlyphRows() {
  return GLYPH_ROWS;
}

export interface BricksCell {
  on: boolean;
  row: number;
  col: number;
}

/**
 * Expand a character's RLE matrix into an array of on/off cells.
 * Each row of the matrix is expanded to `GLYPH_COLUMNS` cells.
 */
export function expandCharCells(c: string): BricksCell[] | null {
  const matrix = getCharMatrix(c);
  if (!matrix) return null;

  const cells: BricksCell[] = [];
  for (let row = 0; row < GLYPH_ROWS; row++) {
    const segments = matrix[row];
    let col = 0;
    let on = false;
    for (const len of segments) {
      for (let i = 0; i < len && col < GLYPH_COLUMNS; i++) {
        cells.push({ on, row, col });
        col++;
      }
      on = !on;
    }
    // Fill remaining columns in this row as "off"
    while (col < GLYPH_COLUMNS) {
      cells.push({ on: false, row, col });
      col++;
    }
  }
  return cells;
}

export const CHARACTER_SPACING = 2;
