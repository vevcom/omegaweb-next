//This file declears which extientions are allowed to be in
//the store system

const mimeTypesByExtension = {
    png: ['image/png'],
    jpeg: ['image/jpeg', 'image/jpg'],
    heic: ['image/heic'],
    avif: ['image/avif'],
    webp: ['image/webp'],
    svg: ['image/svg+xml', 'image/svg'],
    pdf: ['application/pdf'],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StorableExtension = keyof typeof mimeTypesByExtension

const canonicalExtensionByAlias = new Map<string, StorableExtension>([
    ['jpg', 'jpeg'],
])

const canonicalMimeTypeByExtension = new Map<string, string>(
    Object.entries(mimeTypesByExtension).map(([extension, mimeTypes]) => [extension, mimeTypes[0]])
)

/**
 * Which of `candidates` this mime type spells, or null if it spells none of them. The caller decides
 * what is acceptable purely by what it passes as candidates - a mime type this table has never heard
 * of and one that names a format the caller did not ask for are the same answer.
 */
export function extensionForMimeType<Extension extends StorableExtension>(
    mimeType: string,
    candidates: readonly Extension[],
): Extension | null {
    const normalized = mimeType.split(';')[0].trim().toLowerCase()
    return candidates.find(
        candidate => (mimeTypesByExtension[candidate] as readonly string[]).includes(normalized)
    ) ?? null
}

/**
 * Which of `candidates` the file's own bytes say it is, or null if they say none of them. This is what
 * decides a stored file's type: the mime type comes from the client, which can claim anything, so a
 * file is only stored as what its content shows it to be.
 */
export function extensionForContent<Extension extends StorableExtension>(
    content: Buffer,
    candidates: readonly Extension[],
): Extension | null {
    const detected = detectExtension(content)
    return candidates.find(candidate => candidate === detected) ?? null
}

/** The heic brands of an ISO base media file; avif files carry 'avif' or 'avis'. */
const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']

function detectExtension(content: Buffer): StorableExtension | null {
    const startsWith = (bytes: number[], offset = 0) => bytes.every((byte, index) => content[offset + index] === byte)
    const ascii = (start: number, end: number) => content.subarray(start, end).toString('latin1')

    if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
    if (startsWith([0xff, 0xd8, 0xff])) return 'jpeg'
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
    if (ascii(0, 5) === '%PDF-') return 'pdf'
    if (ascii(4, 8) === 'ftyp') {
        // The ftyp box lists the major brand at 8 and the compatible brands from 16 to the end of the box.
        const boxEnd = Math.min(content.readUInt32BE(0), content.length)
        const brands = [ascii(8, 12), ...Array.from(
            { length: Math.max(0, Math.floor((boxEnd - 16) / 4)) },
            (nothing, index) => ascii(16 + index * 4, 20 + index * 4),
        )]
        if (brands.some(brand => brand === 'avif' || brand === 'avis')) return 'avif'
        if (brands.some(brand => heicBrands.includes(brand))) return 'heic'
        return null
    }
    // An svg is text: an optional xml declaration, doctype or comments, then the svg element.
    const text = content.subarray(0, 4096).toString('utf8').replace(/^\uFEFF/, '').trimStart()
    if (text.startsWith('<') && /<svg[\s>]/i.test(text)) return 'svg'
    return null
}

/**
 * The mime type to construct a File with, for a file read off disk by its extension, or null if no
 * known format is named that way. Used by the standard store and the omegaweb-basic migration, whose
 * Note that we are not simply doint image/${extension} because that would produce image/jpg for .jpg files,
 * and the store names every jpeg image .jpeg, so that would be wrong.
 * We need to get the canonical mime type for the extension, and the store will then use that to name the file correctly.
 */
export function mimeTypeForExtension(extension: string): string | null {
    const normalized = extension.trim().toLowerCase().replace(/^\./, '')
    return canonicalMimeTypeByExtension.get(
        canonicalExtensionByAlias.get(normalized) ?? normalized
    ) ?? null
}
