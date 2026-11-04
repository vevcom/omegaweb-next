import '@pn-server-only'
import { storeBackend } from '@/lib/store/backend'
import { extname, relative, resolve, sep } from 'path'

const STORE_ROOT = resolve(process.cwd(), 'store')

/**
 * What of the store is served, by its first path segment. Everything else in the store stays
 * private. Files in a store directory have uuid names that are never reused, so the browser may
 * keep them for as long as it likes. `private` keeps any shared cache in front from holding on to
 * a file after it, or the member on it, is gone.
 */
const SERVED_DIRECTORIES = new Map([
    ['images', { cacheControl: 'private, max-age=31536000, immutable' }],
    ['ombul', { cacheControl: 'private, max-age=31536000, immutable' }],
])

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

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
    const { path: segments } = await params
    const filePath = resolve(STORE_ROOT, ...segments)

    // Reject anything that escapes STORE_ROOT (e.g. `..` segments).
    if (filePath !== STORE_ROOT && !filePath.startsWith(STORE_ROOT + sep)) {
        return new Response('Not found', { status: 404 })
    }

    // Looked up by the resolved path, not the segments: `images/..%2Fother%2Ffile.json` starts with
    // `images`, but is not in it.
    const storePath = relative(STORE_ROOT, filePath).split(sep)
    const served = storePath.length > 1 ? SERVED_DIRECTORIES.get(storePath[0]) : undefined
    if (!served) {
        return new Response('Not found', { status: 404 })
    }

    const stream = await storeBackend.stream(storePath.join('/'))
    if (!stream) {
        return new Response('Not found', { status: 404 })
    }

    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'

    return new Response(stream, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': served.cacheControl,
            'Content-Security-Policy': 'sandbox',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
