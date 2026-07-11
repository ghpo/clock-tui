export interface ThemeDefinition {
  name: string;
  label: string;
  css: Record<string, string>;
}

export const themes: ThemeDefinition[] = [
  {
    name: 'default',
    label: 'AKITA',
    css: {
      '--bg': '#0a0a0a',
      '--surface': '#111111',
      '--surface-alt': '#1a1a1a',
      '--fg': '#00ff00',
      '--fg-dim': '#007700',
      '--clock-color': '#00ff00',
      '--border-color': '#333333',
      '--border-radius': '8px',
      '--section-title-color': '#00ff00',
      '--muted': '#555555',
      '--success': '#00ff00',
      '--warning': '#ff6600',
      '--danger': '#ff0000',
      '--widget-github': '#ff6600',
      '--widget-calendar': '#00ccff',
      '--widget-health': '#00ff00',
      '--font-mono': 'var(--font-geist-mono), monospace',
      '--clock-font': 'var(--font-geist-mono), monospace',
      '--letter-spacing': 'normal',
      '--line-height': '1.35',
    },
  },
  {
    name: 'nerv',
    label: 'NERV',
    css: {
      '--bg': '#0a0a1a',
      '--surface': '#12122a',
      '--surface-alt': '#1a1a35',
      '--fg': '#00e5ff',
      '--fg-dim': '#006680',
      '--clock-color': '#00e5ff',
      '--border-color': '#1a3a5a',
      '--border-radius': '4px',
      '--section-title-color': '#00e5ff',
      '--muted': '#446688',
      '--success': '#00e5ff',
      '--warning': '#ffcc00',
      '--danger': '#ff3366',
      '--widget-github': '#ffcc00',
      '--widget-calendar': '#00e5ff',
      '--widget-health': '#88ddff',
      '--font-mono': 'var(--font-geist-mono), monospace',
      '--clock-font': 'var(--font-geist-mono), monospace',
      '--letter-spacing': 'normal',
      '--line-height': '1.35',
    },
  },
  {
    name: 'retro',
    label: 'CLASSIC',
    css: {
      '--bg': '#0A1022',
      '--surface': 'transparent',
      '--surface-alt': 'transparent',
      '--fg': '#D6D0C5',
      '--fg-dim': '#7D86A8',
      '--clock-color': '#A9B3A6',
      '--border-color': 'transparent',
      '--border-radius': '0px',
      '--section-title-color': '#F0A96B',
      '--muted': '#9C958D',
      '--success': '#A6D77A',
      '--warning': '#F0C15D',
      '--danger': '#D9A4D8',
      '--font-mono': "'JetBrains Mono', 'Iosevka', 'IBM Plex Mono', 'Fira Code', monospace",
      '--clock-font': "'JetBrains Mono', 'Iosevka', 'IBM Plex Mono', 'Fira Code', monospace",
      '--letter-spacing': '-0.04em',
      '--line-height': '0.9',
      '--date-color': '#E8B98B',
      '--hostname-color': '#7D86A8',
      '--workspace-active-bg': '#6E72E6',
      '--workspace-active-fg': '#0A1022',
      '--workspace-inactive-color': '#7D86A8',
      '--github-repo-color': '#A6BCD8',
      '--github-pr-label': '#D8A6D9',
      '--github-pr-number': '#E7C57D',
      '--github-pr-title': '#E7C5A5',
      '--github-issue-label': '#E7C57D',
      '--github-issue-number': '#E7C57D',
      '--github-issue-title': '#E7C5A5',
      '--github-meta': '#9B948A',
      '--health-title-color': '#F2D36E',
      '--health-check-icon': '#A7D57E',
      '--health-warn-icon': '#F0C15D',
      '--health-text': '#D6D0C5',
      '--calendar-title-color': '#F0A96B',
      '--calendar-date-color': '#7EA8FF',
      '--calendar-time-color': '#A8BDD8',
      '--calendar-event-color': '#D8D2C6',
      '--orange': '#F0A96B',
      '--yellow': '#EAC76A',
      '--blue': '#7EA8FF',
      '--green': '#A6D77A',
      '--purple': '#D9A4D8',
      '--gray-blue': '#A7B5C9',
      '--text-secondary': '#9C958D',
    },
  },
];

export function getTheme(name: string): ThemeDefinition {
  return themes.find((t) => t.name === name) || themes[0];
}

export function getThemeIndex(name: string): number {
  const idx = themes.findIndex((t) => t.name === name);
  return idx >= 0 ? idx : 0;
}

export function getThemeName(index: number): string {
  return themes[index]?.name || themes[0].name;
}

export function applyThemeCss(name: string): void {
  if (typeof document === 'undefined') return;
  const theme = getTheme(name);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.css)) {
    root.style.setProperty(key, value);
  }
}
