import { loadedChatSdk } from './sdk'
import type { MatrixClient } from 'matrix-js-sdk'

/** Where the homeserver keeps a file, which is what an `mxc://` address names. */
export type Media = { serverName: string, mediaId: string }

/**
 * What a file is fetched as. A thumbnail is a small picture the homeserver made of a picture, and
 * a picture is the picture itself: both are given only as a picture a page may show. A download
 * is any file, given as bytes that are nothing to a browser but something to save.
 */
export type FetchedAs = 'THUMBNAIL' | 'PICTURE' | 'DOWNLOAD'

/**
 * The kinds of picture that are shown, and sent as a picture. An SVG is a document that may hold
 * a script, so it is a file here.
 */
export const PICTURE_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

const MEDIA_PREFIX = '/_matrix/client/v1/media'
const UPLOAD_PREFIX = '/_matrix/media/v3'
/** What a thumbnail is asked for as: twice the box a line shows it in, for a dense screen. */
const THUMBNAIL = { width: '640', height: '480', method: 'scale' }
const mxc = /^mxc:\/\/([A-Za-z0-9.:[\]-]{1,255})\/([A-Za-z0-9_-]{1,255})$/

/** A file that is larger than the homeserver takes, which is `limit` bytes. */
export class FileTooLarge extends Error {
    constructor(readonly limit: number) {
        super('The file is larger than the homeserver takes')
    }
}

/** What an address names where it is one of the homeserver's, and null for every other, which is never fetched. */
export function mediaOf(address: unknown): Media | null {
    const [, serverName, mediaId] = (typeof address === 'string' && mxc.exec(address)) || []
    // A name of dots alone would be a step up the path of what is fetched.
    return serverName && mediaId && /[^.]/.test(serverName) ? { serverName, mediaId } : null
}

/**
 * Fetches a file from the homeserver, which gives its files only to one who is signed in, so no
 * address of one works in a page by itself. What the homeserver says a file is, is what whoever
 * uploaded it said. So a picture is given only when it says it is of a kind that is shown, and
 * rejects otherwise, and a download is given as bytes of no kind, which a browser saves and never
 * opens.
 */
export async function fetchMedia(
    client: MatrixClient,
    { serverName, mediaId }: Media,
    as: FetchedAs,
    signal?: AbortSignal,
): Promise<Blob> {
    const { Method } = loadedChatSdk()
    const fetched = await client.http.authedRequest<Blob>(
        Method.Get,
        `/${as === 'THUMBNAIL' ? 'thumbnail' : 'download'}/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`,
        as === 'THUMBNAIL' ? THUMBNAIL : undefined,
        undefined,
        { prefix: MEDIA_PREFIX, rawResponseBody: true, abortSignal: signal },
    )
    if (as === 'DOWNLOAD') return new Blob([fetched], { type: 'application/octet-stream' })
    if (!PICTURE_TYPES.includes(fetched.type)) throw new Error('The homeserver gave what is no picture to show')
    return fetched
}

/** How many bytes the homeserver takes in one file, and null where it does not say. */
export async function uploadLimitOf(client: MatrixClient): Promise<number | null> {
    const limit: unknown = await client.getMediaConfig(true).then(config => config['m.upload.size'], () => null)
    return typeof limit === 'number' && Number.isFinite(limit) && limit >= 0 ? limit : null
}

/** Uploads a file from the browser straight to the homeserver, and gives the address it has there. */
export async function uploadMedia(client: MatrixClient, file: Blob, signal?: AbortSignal): Promise<string> {
    const { Method } = loadedChatSdk()
    const { content_uri: address } = await client.http.authedRequest<{ content_uri: string }>(
        Method.Post,
        '/upload',
        undefined,
        file,
        { prefix: UPLOAD_PREFIX, headers: { 'Content-Type': file.type || 'application/octet-stream' }, abortSignal: signal },
    )
    return address
}

/** Whether a file was not taken because it is too large, as the limit has it or as the homeserver answered. */
export function isTooLarge(error: unknown): boolean {
    const { HTTPError, MatrixError } = loadedChatSdk()
    // What stands before the homeserver may answer in its place, and that is no error of Matrix.
    return error instanceof FileTooLarge
        || error instanceof MatrixError && error.errcode === 'M_TOO_LARGE'
        || error instanceof HTTPError && error.httpStatus === 413
}

/** Whether what was asked was stopped by the one who asked. */
export function isStopped(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
}
