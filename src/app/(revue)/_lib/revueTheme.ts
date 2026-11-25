import { contrastRatio, mixColors, moreReadableText, readableContrast } from '@/lib/colors'
import type { ThemeColors } from '@/lib/theme'

type ToneColors = Pick<ThemeColors, `--color-${'neutral' | 'info' | 'success' | 'warning' | 'error'}${'' | '-content'}`>

/** The neutral and status colours of a revue's theme, one set per tone. Each colour reads at 4.5:1 with its content. */
const revueToneColors: Record<ThemeColors['color-scheme'], ToneColors> = {
    dark: {
        '--color-neutral': '#3d2f2a',
        '--color-neutral-content': '#f3e8d8',
        '--color-info': '#6cc4dc',
        '--color-info-content': '#0c1a1f',
        '--color-success': '#6fcf8a',
        '--color-success-content': '#0b1d10',
        '--color-warning': '#f0c45a',
        '--color-warning-content': '#231803',
        '--color-error': '#ff7b6b',
        '--color-error-content': '#240806',
    },
    light: {
        '--color-neutral': '#e6ddd2',
        '--color-neutral-content': '#2a1f1a',
        '--color-info': '#0e6f86',
        '--color-info-content': '#ffffff',
        '--color-success': '#17692f',
        '--color-success-content': '#ffffff',
        '--color-warning': '#8a5a00',
        '--color-warning-content': '#ffffff',
        '--color-error': '#b3261e',
        '--color-error-content': '#ffffff',
    },
}

/** A dark stage: warm near-black with cream text, a curtain red and a gold. */
export const revueTheme: ThemeColors = {
    'color-scheme': 'dark',
    '--color-base-100': '#140d0c',
    '--color-base-200': '#1f1816',
    '--color-base-300': '#2d2522',
    '--color-base-content': '#f3e8d8',
    '--color-primary': '#ff5a4c',
    '--color-primary-content': '#1a0b09',
    '--color-secondary': '#7d1f1d',
    '--color-secondary-content': '#f6ead8',
    '--color-accent': '#e2b250',
    '--color-accent-content': '#1f1406',
    ...revueToneColors.dark,
}

const deepestBaseStep = 0.11

/** The static theme's own texts, which a revue's theme picks the more readable of for each colour. */
const darkText = revueTheme['--color-primary-content']
const lightText = revueTheme['--color-base-content']

export type RevuePalette = {
    themeBackground: string,
    themePrimary: string,
    themeSecondary: string,
    themeAccent: string,
}

export const defaultRevuePalette: RevuePalette = {
    themeBackground: revueTheme['--color-base-100'],
    themePrimary: revueTheme['--color-primary'],
    themeSecondary: revueTheme['--color-secondary'],
    themeAccent: revueTheme['--color-accent'],
}

/**
 * A derived colour is never less readable than the best a text can do on the revue's background: 4.5:1,
 * or the contrast the more readable text reaches there when that is less. A status colour is moved
 * towards the text until it is that readable, which only takes it further from its content, the other
 * text of the tone, so the content stays.
 */
export function revueThemeOf(palette: RevuePalette): ThemeColors {
    const background = palette.themeBackground
    const baseContent = readableText(background)
    const tone = baseContent === darkText ? 'light' : 'dark'
    const surfaceDirection = baseDirection(background, baseContent)
    const base200 = mixColors(background, surfaceDirection, 0.05)
    const toneColors = revueToneColors[tone]
    const statusColor = (color: 'success' | 'warning' | 'error') => towardsReadable(
        toneColors[`--color-${color}`], baseContent, [background, base200], textBar(background, baseContent)
    )
    return {
        ...toneColors,
        'color-scheme': tone,
        '--color-base-100': background,
        '--color-base-200': base200,
        '--color-base-300': mixColors(background, surfaceDirection, deepestBaseStep),
        '--color-base-content': baseContent,
        '--color-primary': palette.themePrimary,
        '--color-primary-content': buttonText(palette.themePrimary),
        '--color-secondary': palette.themeSecondary,
        '--color-secondary-content': buttonText(palette.themeSecondary),
        '--color-accent': palette.themeAccent,
        '--color-accent-content': buttonText(palette.themeAccent),
        '--color-success': statusColor('success'),
        '--color-warning': statusColor('warning'),
        '--color-error': statusColor('error'),
    }
}

/** About as dark as the 7% the btn utilities of tailwind.css mix in oklab, which this sRGB mix stands in for. */
function buttonHover(color: string): string {
    return mixColors(color, '#000000', 0.1)
}

function readableText(background: string): string {
    return moreReadableText([background], darkText, lightText)
}

/** A button's text must read on it under the pointer too. */
function buttonText(color: string): string {
    return moreReadableText([color, buttonHover(color)], darkText, lightText)
}

/**
 * The contrast asked of a text on a surface: 4.5:1, or what it reaches on the background when that is
 * less. At a share under 1 the text is faded into the surface that much first, as text-base-content/80 is.
 */
function textBar(background: string, text: string, share = 1): number {
    return Math.min(readableContrast, contrastRatio(mixColors(background, text, share), background))
}

/**
 * Towards the text, as the static theme's bases step, where even the deepest step keeps the text and the
 * text at 80% at their bars. Otherwise away from it, which only raises their contrast, so the bases still
 * stand apart from the page.
 */
function baseDirection(background: string, text: string): string {
    const deepest = mixColors(background, text, deepestBaseStep)
    const keepsBars = contrastRatio(text, deepest) >= textBar(background, text)
        && contrastRatio(mixColors(deepest, text, 0.8), deepest) >= textBar(background, text, 0.8)
    if (keepsBars) return text
    return text === darkText ? '#ffffff' : '#000000'
}

function towardsReadable(color: string, text: string, backgrounds: string[], bar: number): string {
    for (let twentieths = 0; twentieths < 20; twentieths++) {
        const moved = mixColors(color, text, twentieths / 20)
        if (backgrounds.every(background => contrastRatio(moved, background) >= bar)) return moved
    }
    return text
}
