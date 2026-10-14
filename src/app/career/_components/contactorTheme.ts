import type { ThemeColors } from '@/lib/theme'

/**
 * Contactor's palette (contactor.no) in the site's theme variables, so that the shared components
 * rendered under /career - forms, CMS editors, event cards - take its colours. It is fixed: the
 * theme a user has chosen does not apply on Contactor's pages. The root layout sets it on <html>
 * for those pages in place of the user's theme.
 */
export const contactorTheme: ThemeColors = {
    layer: 'hsla(222, 45%, 18%, 0.06)',
    text: '#0f172a',
    'text-muted': '#475569',
    'surface-base': '#eef1f6',
    'surface-raised': '#ffffff',
    'surface-hover': '#e2e7ef',
    'surface-subtle': '#c2cbd9',
    'ink-hover': '#2d3f5e',
    'ink-strong': '#0f1a2e',
    'accent-red': 'hsl(0, 70%, 45%)',
    'accent-orange': '#f97316',
    'accent-yellow': '#ffc23c',
    'accent-green': 'hsl(120, 60%, 32%)',
    'accent-cyan': '#22d3ee',
    'accent-blue': '#0891b2',
    'accent-magenta': 'hsl(300, 60%, 40%)',
    'accent-violet': 'hsl(260, 55%, 45%)',
}
