/** The contrast WCAG asks of normal text against its background, level AA. */
export const readableContrast = 4.5

/** The WCAG contrast ratio of two colours written as `#rrggbb`, from 1 to 21. */
export function contrastRatio(firstHex: string, secondHex: string): number {
    const firstLuminance = relativeLuminance(firstHex)
    const secondLuminance = relativeLuminance(secondHex)
    return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05)
}

/** The colour `amount` of the way from `from` to `to`, mixed per channel in sRGB, as `#rrggbb`. */
export function mixColors(from: string, to: string, amount: number): string {
    const fromChannels = hexToRgb(from)
    const toChannels = hexToRgb(to)
    const mixed = fromChannels.map((channel, index) => Math.round(channel + (toChannels[index] - channel) * amount))
    return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

/** How light a colour written as `#rrggbb` is to the eye, as WCAG defines it: 0 for black, 1 for white. */
export function relativeLuminance(hex: string): number {
    const [red, green, blue] = hexToRgb(hex).map(linearChannel)
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

export function hexToRgb(hex: string): [number, number, number] {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
    if (!match) throw new Error(`${hex} is not a colour written as #rrggbb`)
    return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)]
}

function linearChannel(channel: number): number {
    const fraction = channel / 255
    return fraction <= 0.04045 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4
}
