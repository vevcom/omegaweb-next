import '@pn-server-only'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname, relative, resolve, sep } from 'path'
import { Readable } from 'stream'

const STORE_ROOT = resolve(process.cwd(), 'store')

/**
 * What of the store is served, by its first path segment. Everything else under `store/` stays
 * on disk. Files in a store directory have uuid names that are never reused, so the browser may
 * keep them for as long as it likes. `private` keeps any shared cache in front from holding on to
 * a file after it, or the member on it, is gone.
 */
const SERVED_DIRECTORIES = new Map([
    ['images', { cacheControl: 'private, max-age=31536000, immutable' }],
    ['ombul', { cacheControl: 'private, max-age=31536000, immutable' }],
])

/** Single files served from directories that are not. Rewritten in place, so never cached. */
const SERVED_FILES = new Map([
    ['releaseCountdown/gitGraph.json', { cacheControl: 'private, no-store' }],
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
    '.json': 'application/json',
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
    const served = SERVED_FILES.get(storePath.join('/')) ??
        (storePath.length > 1 ? SERVED_DIRECTORIES.get(storePath[0]) : undefined)
    if (!served) {
        return new Response('Not found', { status: 404 })
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        return new Response('Not found', { status: 404 })
    }

    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream

    return new Response(stream, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': served.cacheControl,
            'Content-Security-Policy': 'sandbox',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
