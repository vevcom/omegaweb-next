import '@pn-server-only'
import { streamStoreFile } from '@/services/store/serve'
import { extname } from 'path'

/**
 * Files in the store have uuid names that are never reused, so the browser may keep them for as
 * long as it likes. `private` keeps any shared cache in front from holding on to a file after it,
 * or the member on it, is gone.
 */
const CACHE_CONTROL = 'private, max-age=31536000, immutable'

const MIME_TYPES: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.heic': 'image/heic',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
}

/**
 * Serves the store files at the paths `storeFilePath` gives: a directory and the name of a file.
 * The store looks the name up among its files, so nothing but what it keeps there can be reached.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path: segments } = await params
    if (segments.length !== 2) {
        return new Response('Not found', { status: 404 })
    }
    const [directory, name] = segments

    const stream = await streamStoreFile(directory, name)
    if (!stream) {
        return new Response('Not found', { status: 404 })
    }

    return new Response(stream, {
        headers: {
            'Content-Type': MIME_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream',
            'Cache-Control': CACHE_CONTROL,
            'Content-Security-Policy': 'sandbox',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
