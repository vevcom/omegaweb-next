import '@pn-server-only'
import { createReadStream, existsSync, statSync } from 'fs'
import { extname, resolve, sep } from 'path'
import { Readable } from 'stream'

const STORE_ROOT = resolve(process.cwd(), 'store')

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

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        return new Response('Not found', { status: 404 })
    }

    const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream

    return new Response(stream, {
        headers: {
            'Content-Type': contentType,
            'Content-Security-Policy': 'sandbox',
            'X-Content-Type-Options': 'nosniff',
        },
    })
}
