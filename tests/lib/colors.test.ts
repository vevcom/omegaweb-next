import { contrastRatio, mixColors, moreReadableText, readableContrast } from '@/lib/colors'
import {
    defaultRevuePalette,
    revueTheme,
    revueThemeOf,
} from '@/app/(revue)/_lib/revueTheme'
import { describe, expect, test } from '@jest/globals'
import type { RevuePalette } from '@/app/(revue)/_lib/revueTheme'
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

describe('the more readable of two texts', () => {
    test('is the one with the higher contrast on the background', () => {
        expect(moreReadableText(['#ffffff'], '#ffffee', '#111111')).toBe('#111111')
        expect(moreReadableText(['#000000'], '#ffffee', '#111111')).toBe('#ffffee')
    })

    test('goes by the lowest contrast when there are several backgrounds', () => {
        expect(moreReadableText(['#ffffff', '#000000'], '#ffffff', '#808080')).toBe('#808080')
    })
})

describe('the theme of a revue', () => {
    const darkText = revueTheme['--color-primary-content']
    const lightText = revueTheme['--color-base-content']

    // Every 17th value of each channel from black to white: dark, light, greys between and saturated colours.
    const colors = colorGrid(17)
    const palettes: RevuePalette[] = colors.map((color, index) => ({
        themeBackground: color,
        themePrimary: colors[(index * 7 + 1) % colors.length],
        themeSecondary: colors[(index * 11 + 2) % colors.length],
        themeAccent: colors[(index * 13 + 3) % colors.length],
    }))

    // What may be asked of a colour on a surface: 4.5:1, or what the more readable of the two texts reaches
    // there when that is less. At a share under 1 that text is first faded into the surface that much, as
    // text-base-content/80 is.
    function bar(surface: string, share = 1) {
        const best = contrastRatio(darkText, surface) >= contrastRatio(lightText, surface) ? darkText : lightText
        return Math.min(readableContrast, contrastRatio(mixColors(surface, best, share), surface))
    }

    function hovered(color: string) {
        return mixColors(color, '#000000', 0.1)
    }

    test('is dark on a dark background and light on a light one', () => {
        const ofBackground = (themeBackground: string) => revueThemeOf({ ...defaultRevuePalette, themeBackground })
        expect(ofBackground('#000000')['color-scheme']).toBe('dark')
        expect(ofBackground('#140d0c')['color-scheme']).toBe('dark')
        expect(ofBackground('#f6efe3')['color-scheme']).toBe('light')
        expect(ofBackground('#ffffff')['color-scheme']).toBe('light')
    })

    test('writes every colour as #rrggbb', () => {
        for (const palette of palettes.slice(0, 64)) {
            for (const [key, value] of Object.entries(revueThemeOf(palette))) {
                if (key !== 'color-scheme') expect(value).toMatch(/^#[0-9a-f]{6}$/)
            }
        }
    })

    const bases = ['--color-base-100', '--color-base-200', '--color-base-300'] as const

    test('has the text on every base as readable as a text can be on the background', () => {
        const unreadable = palettes.flatMap(palette => {
            const theme = revueThemeOf(palette)
            return bases
                .filter(base => contrastRatio(theme['--color-base-content'], theme[base]) < bar(palette.themeBackground))
                .map(base => `${base} of ${palette.themeBackground}`)
        })
        expect(unreadable).toEqual([])
    })

    test('has the text at 80% on every base as readable as a text at 80% can be on the background', () => {
        const unreadable = palettes.flatMap(palette => {
            const theme = revueThemeOf(palette)
            return bases.filter(base => {
                const dimmed = mixColors(theme[base], theme['--color-base-content'], 0.8)
                return contrastRatio(dimmed, theme[base]) < bar(palette.themeBackground, 0.8)
            }).map(base => `${base} of ${palette.themeBackground}`)
        })
        expect(unreadable).toEqual([])
    })

    test('has error, success and warning on the page and on a card as readable as a text can be there', () => {
        const unreadable = palettes.flatMap(palette => {
            const theme = revueThemeOf(palette)
            return (['error', 'success', 'warning'] as const).flatMap(color => (
                (['--color-base-100', '--color-base-200'] as const)
                    .filter(base => contrastRatio(theme[`--color-${color}`], theme[base]) < bar(palette.themeBackground))
                    .map(base => `${color} on ${base} of ${palette.themeBackground}`)
            ))
        })
        expect(unreadable).toEqual([])
    })

    const buttonColors = ['primary', 'secondary', 'accent', 'neutral', 'success', 'warning', 'error'] as const

    // One text serves a button and its hover, so the best it can do is the better of the two texts' worse sides.
    function buttonBar(color: string) {
        const worse = (text: string) => Math.min(contrastRatio(text, color), contrastRatio(text, hovered(color)))
        return Math.min(readableContrast, Math.max(worse(darkText), worse(lightText)))
    }

    test('has each button text as readable on its colour and on its hover as one text can be on both', () => {
        const unreadable = palettes.flatMap(palette => {
            const theme = revueThemeOf(palette)
            return buttonColors.flatMap(color => {
                const content = theme[`--color-${color}-content`]
                const background = theme[`--color-${color}`]
                return [background, hovered(background)]
                    .filter(surface => contrastRatio(content, surface) < buttonBar(background))
                    .map(surface => `${color} ${surface} of ${background}`)
            })
        })
        expect(unreadable).toEqual([])
    })

    // The static theme's own bases stand 1.07 and 1.14 apart. A step has less room on a saturated colour near
    // the edge of sRGB, such as #ff00ff, so every base only has to stand apart, and a grey by close to as much.
    function basesApart(background: string) {
        const theme = revueThemeOf({ ...defaultRevuePalette, themeBackground: background })
        return Math.min(
            contrastRatio(theme['--color-base-100'], theme['--color-base-200']),
            contrastRatio(theme['--color-base-200'], theme['--color-base-300']),
        )
    }

    test('has its bases apart from the page and from each other on every background', () => {
        const flat = colors.filter(background => basesApart(background) < 1.005)
        expect(flat).toEqual([])
    })

    test('has its bases apart on a grey by about as much as the static theme\'s', () => {
        const greys = Array.from({ length: 256 }, (_unused, value) => `#${value.toString(16).padStart(2, '0').repeat(3)}`)
        const flat = greys.filter(background => basesApart(background) < 1.04)
        expect(flat).toEqual([])
    })

    // A step away from the text has nowhere to go from black under a light text or white under a dark one.
    test.each(['#000000', '#ffffff'])('steps the bases of %s towards its text', background => {
        const theme = revueThemeOf({ ...defaultRevuePalette, themeBackground: background })
        expect(theme['--color-base-200']).toBe(mixColors(background, theme['--color-base-content'], 0.05))
        expect(theme['--color-base-300']).toBe(mixColors(background, theme['--color-base-content'], 0.11))
    })

    test.each(['#808080', '#777777'])('keeps the text readable on the cards of %s, which stand apart', background => {
        const theme = revueThemeOf({ ...defaultRevuePalette, themeBackground: background })
        expect(theme['--color-base-300']).not.toBe('#757373')
        expect(new Set(bases.map(base => theme[base])).size).toBe(3)
        for (const base of bases) {
            expect(contrastRatio(theme['--color-base-content'], theme[base]))
                .toBeGreaterThanOrEqual(contrastRatio(theme['--color-base-content'], background))
        }
    })

    test('moves the status colours on a background no text reads well on until they read as the text does', () => {
        const theme = revueThemeOf({ ...defaultRevuePalette, themeBackground: '#777777' })
        const textContrast = contrastRatio(theme['--color-base-content'], '#777777')
        expect(textContrast).toBeCloseTo(4.28, 2)
        for (const color of ['error', 'success', 'warning'] as const) {
            expect(contrastRatio(theme[`--color-${color}`], '#777777')).toBeGreaterThanOrEqual(textContrast)
        }
    })

    test('steps base-200 and base-300 from the background towards the text', () => {
        const theme = revueThemeOf(defaultRevuePalette)
        const towardsText = (base: string) => contrastRatio(base, theme['--color-base-content'])
        expect(towardsText(theme['--color-base-200'])).toBeLessThan(towardsText(theme['--color-base-100']))
        expect(towardsText(theme['--color-base-300'])).toBeLessThan(towardsText(theme['--color-base-200']))
    })

    const toneColorKeys = ['neutral', 'info', 'success', 'warning', 'error'].flatMap(color => (
        [`--color-${color}`, `--color-${color}-content`] as const
    )) as ColorKey[]

    test('takes the bases, the neutral and the status colours of the static theme for the static palette', () => {
        const theme = revueThemeOf(defaultRevuePalette)
        for (const key of [...bases, ...toneColorKeys]) expect(theme[key]).toBe(revueTheme[key])
    })

    const lightTheme = revueThemeOf({ ...defaultRevuePalette, themeBackground: '#ffffff' })

    test.each(['neutral', 'info', 'success', 'warning', 'error'] as const)(
        'has %s readable with its content, hovered too, when it is light',
        color => {
            const background = lightTheme[`--color-${color}`]
            const content = lightTheme[`--color-${color}-content`]
            expect(contrastRatio(content, background)).toBeGreaterThanOrEqual(readableContrast)
            expect(contrastRatio(content, hovered(background))).toBeGreaterThanOrEqual(readableContrast)
        }
    )
})

function colorGrid(step: number): string[] {
    const grid: string[] = []
    for (let red = 0; red < 256; red += step) {
        for (let green = 0; green < 256; green += step) {
            for (let blue = 0; blue < 256; blue += step) {
                grid.push(`#${[red, green, blue].map(channel => channel.toString(16).padStart(2, '0')).join('')}`)
            }
        }
    }
    return grid
}
