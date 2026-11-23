import { contrastRatio, mixColors, readableContrast } from '@/lib/colors'
import { revueTheme } from '@/app/(revue)/_lib/revueTheme'
import { describe, expect, test } from '@jest/globals'
import type { ThemeColors } from '@/lib/theme'

type ColorKey = Exclude<keyof ThemeColors, 'color-scheme'>

describe('the contrast ratio', () => {
    test('is 21 between black and white and 1 between a colour and itself', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
        expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21)
        expect(contrastRatio('#7d1f1d', '#7d1f1d')).toBe(1)
    })

    test('matches the WCAG value of a grey on white', () => {
        expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2)
    })

    test('refuses what is not written as #rrggbb', () => {
        expect(() => contrastRatio('#fff', '#000000')).toThrow()
        expect(() => contrastRatio('hsl(0, 0%, 100%)', '#000000')).toThrow()
    })
})

describe('mixing two colours', () => {
    test('goes from the first at 0 to the second at 1, in lower case', () => {
        expect(mixColors('#7D1F1D', '#ffffff', 0)).toBe('#7d1f1d')
        expect(mixColors('#7d1f1d', '#FFFFFF', 1)).toBe('#ffffff')
    })

    test('mixes each channel in sRGB', () => {
        expect(mixColors('#000000', '#ffffff', 0.5)).toBe('#808080')
        expect(mixColors('#ff0000', '#0000ff', 0.25)).toBe('#bf0040')
    })
})

describe('the static revue theme', () => {
    const textOnBackground: [ColorKey, ColorKey][] = [
        ['--color-base-content', '--color-base-100'],
        ['--color-base-content', '--color-base-200'],
        ['--color-base-content', '--color-base-300'],
        ['--color-primary-content', '--color-primary'],
        ['--color-secondary-content', '--color-secondary'],
        ['--color-accent-content', '--color-accent'],
        ['--color-neutral-content', '--color-neutral'],
        ['--color-info-content', '--color-info'],
        ['--color-success-content', '--color-success'],
        ['--color-warning-content', '--color-warning'],
        ['--color-error-content', '--color-error'],
        // Links, and text-primary on inputs whose hover and focus background is base-300.
        ['--color-primary', '--color-base-100'],
        ['--color-primary', '--color-base-200'],
        ['--color-primary', '--color-base-300'],
        // The login pill, the hovered links of the header, menu and footer, and the focus outline.
        ['--color-accent', '--color-base-100'],
        ['--color-accent', '--color-base-200'],
        ['--color-accent', '--color-base-300'],
        // What a form says about an input, on the page and on a card.
        ['--color-error', '--color-base-100'],
        ['--color-error', '--color-base-200'],
        ['--color-success', '--color-base-100'],
        ['--color-success', '--color-base-200'],
        ['--color-warning', '--color-base-100'],
        ['--color-warning', '--color-base-200'],
    ]

    test.each(textOnBackground)('has %s readable on %s', (text, background) => {
        expect(contrastRatio(revueTheme[text], revueTheme[background])).toBeGreaterThanOrEqual(readableContrast)
    })

    const bases: ColorKey[] = ['--color-base-100', '--color-base-200', '--color-base-300']

    // The links of the header and the footer are text-base-content/80.
    test.each(bases)('has the text at 80%% readable on %s', background => {
        const dimmed = mixColors(revueTheme[background], revueTheme['--color-base-content'], 0.8)
        expect(contrastRatio(dimmed, revueTheme[background])).toBeGreaterThanOrEqual(readableContrast)
    })

    const buttons: [ColorKey, ColorKey][] = [
        ['--color-primary-content', '--color-primary'],
        ['--color-neutral-content', '--color-neutral'],
        ['--color-base-content', '--color-base-200'],
        ['--color-secondary-content', '--color-secondary'],
        ['--color-info-content', '--color-info'],
        ['--color-success-content', '--color-success'],
        ['--color-warning-content', '--color-warning'],
        ['--color-error-content', '--color-error'],
    ]

    // The btn-* hover darkens 7% in oklab. 10% black mixed in sRGB darkens about as much, which the
    // browser's own hover colours were checked against.
    test.each(buttons)('has %s readable on a hovered button of %s', (text, background) => {
        const hovered = mixColors(revueTheme[background], '#000000', 0.1)
        expect(contrastRatio(revueTheme[text], hovered)).toBeGreaterThanOrEqual(readableContrast)
    })
})
