import { loadedChatSdk } from './sdk'
import type { MatrixClient } from 'matrix-js-sdk'

/**
 * Where the homeserver keeps a file, which is what an `mxc://` address names. A file of an
 * encrypted room is kept encrypted there, and `encrypted` is then what its message says it is
 * unlocked with.
 */
export type Media = { serverName: string, mediaId: string, encrypted?: FileKey }

/** What an encrypted file is unlocked with, and what it is known by: all three are unpadded base64. */
export type FileKey = { key: string, iv: string, sha256: string }

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
/** The most that is fetched by itself to show a picture in its line. */
const SHOWN_IN_LINE_AT_MOST = 10 * 2 ** 20
const UPLOAD_PREFIX = '/_matrix/media/v3'
/** What a thumbnail is asked for as: twice the box a line shows it in, for a dense screen. */
const THUMBNAIL = { width: '640', height: '480', method: 'scale' }
const base64OfBytes = (bytes: number) => new RegExp(`^[A-Za-z0-9+/_-]{${Math.ceil(bytes * 4 / 3)}}$`)
const [KEY, IV, SHA256] = [base64OfBytes(32), base64OfBytes(16), base64OfBytes(32)]
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
 * What an encrypted file of a message names and is unlocked with, where the message says both as
 * Matrix has it, and null otherwise.
 */
export function encryptedMediaOf(file: unknown): Media | null {
    const { url, key, iv, hashes } = recordOf(file)
    const [{ k: secret, alg }, { sha256 }] = [recordOf(key), recordOf(hashes)]
    const media = mediaOf(url)
    const isKey = alg === 'A256CTR' && typeof secret === 'string' && KEY.test(secret)
        && typeof iv === 'string' && IV.test(iv) && typeof sha256 === 'string' && SHA256.test(sha256)
    return media && isKey ? { ...media, encrypted: { key: secret, iv, sha256 } } : null
}

/**
 * Fetches a file from the homeserver, which gives its files only to one who is signed in, so no
 * address of one works in a page by itself. What the homeserver says a file is, is what whoever
 * uploaded it said. So a picture is given only when it says it is of a kind that is shown, and
 * rejects otherwise, and a download is given as bytes of no kind, which a browser saves and never
 * opens.
 *
 * An encrypted file is unlocked here, in the browser. The homeserver cannot say what it is or make
 * a small picture of it, so it is fetched whole, and it is a picture only where its first bytes
 * are those of a kind that is shown. It is then given as that kind, whatever its message calls it,
 * so nothing that is a document is ever given as a picture.
 *
 * A thumbnail is what a line fetches by itself, so no more than SHOWN_IN_LINE_AT_MOST is taken
 * of it, by what the homeserver sends and not by what the message says: the fetch is let go of
 * where more comes, before anything is unlocked. A picture that large is a file to download.
 */
export async function fetchMedia(
    client: MatrixClient,
    { serverName, mediaId, encrypted }: Media,
    as: FetchedAs,
    signal?: AbortSignal,
): Promise<Blob> {
    const { Method } = loadedChatSdk()
    const ofHomeserver = as === 'THUMBNAIL' && !encrypted
    const kind = ofHomeserver ? 'thumbnail' : 'download'
    const path = `/${kind}/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`
    const query = ofHomeserver ? THUMBNAIL : undefined
    const fetched = as === 'THUMBNAIL'
        ? await fetchedWithin(client, client.http.getUrl(path, query, MEDIA_PREFIX), SHOWN_IN_LINE_AT_MOST, signal)
        : await client.http.authedRequest<Blob>(Method.Get, path, query, undefined, {
            prefix: MEDIA_PREFIX,
            rawResponseBody: true,
            abortSignal: signal,
        })
    const file = encrypted ? await unlocked(fetched, encrypted) : fetched
    if (as === 'DOWNLOAD') return new Blob([file], { type: 'application/octet-stream' })
    const type = file instanceof ArrayBuffer ? pictureTypeOf(file) : file.type
    if (type === null || !PICTURE_TYPES.includes(type)) throw new Error('What was fetched is no picture to show')
    return new Blob([file], { type })
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

/**
 * Encrypts a file in the browser and uploads it, so the homeserver keeps what it cannot read, and
 * gives what a message says of such a file: where it is and what unlocks it, as Matrix has it.
 */
export async function uploadEncryptedMedia(client: MatrixClient, file: Blob, signal?: AbortSignal) {
    const { encodeUnpaddedBase64 } = loadedChatSdk()
    // The half of it that counts the blocks starts at nothing, as Matrix asks.
    const iv = crypto.getRandomValues(new Uint8Array(16)).fill(0, 8)
    const key = await crypto.subtle.generateKey({ name: 'AES-CTR', length: 256 }, true, ['encrypt', 'decrypt'])
    const locked = await crypto.subtle.encrypt({ name: 'AES-CTR', counter: iv, length: 64 }, key, await file.arrayBuffer())
    const sha256 = await crypto.subtle.digest('SHA-256', locked)
    return {
        url: await uploadMedia(client, new Blob([locked], { type: 'application/octet-stream' }), signal),
        key: { ...await crypto.subtle.exportKey('jwk', key), key_ops: ['encrypt', 'decrypt'] },
        iv: encodeUnpaddedBase64(iv),
        hashes: { sha256: encodeUnpaddedBase64(new Uint8Array(sha256)) },
        // eslint-disable-next-line id-length -- What Matrix calls the version of this.
        v: 'v2',
    }
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

/**
 * Fetches from the homeserver as the user and gives what came, where that is no more than
 * `limit` bytes. The SDK gives what it fetches only once it has all of it, so this reads what
 * comes itself and lets go of the rest when it is more. The SDK trades the session's tokens for
 * new ones when it is refused itself, so one refusal here asks it something first and tries again.
 */
async function fetchedWithin(client: MatrixClient, url: URL, limit: number, signal?: AbortSignal): Promise<Blob> {
    // The token is the homeserver's alone, so it is never sent on to where an answer points.
    const ask = () => client.http.fetch(url, {
        headers: { Authorization: `Bearer ${client.getAccessToken()}` },
        redirect: 'error',
        signal,
    })
    let answer = await ask()
    if (answer.status === 401) {
        await answer.body?.cancel()
        await client.whoami()
        answer = await ask()
    }
    const parts: Uint8Array<ArrayBuffer>[] = []
    const reader = answer.body?.getReader()
    let taken = 0
    const isTooMuch = () => taken > limit || Number(answer.headers.get('Content-Length')) > limit
    while (answer.ok && reader && !isTooMuch()) {
        const { done, value } = await reader.read()
        if (done) return new Blob(parts, { type: answer.headers.get('Content-Type') ?? '' })
        parts.push(new Uint8Array(value))
        taken += value.byteLength
    }
    await reader?.cancel()
    throw new Error(answer.ok ? 'What was fetched is more than is shown in a line' : 'The homeserver did not give the file')
}

/** An encrypted file as it was before it was encrypted. One that is not the file its message tells of is refused. */
async function unlocked(file: Blob, { key, iv, sha256 }: FileKey): Promise<ArrayBuffer> {
    const { decodeBase64, encodeUnpaddedBase64 } = loadedChatSdk()
    const locked = await file.arrayBuffer()
    if (encodeUnpaddedBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', locked))) !== sha256) {
        throw new Error('The file is not the one its message tells of')
    }
    const jwk = { kty: 'oct', alg: 'A256CTR', k: key }
    const secret = await crypto.subtle.importKey('jwk', jwk, 'AES-CTR', false, ['decrypt'])
    return crypto.subtle.decrypt({ name: 'AES-CTR', counter: decodeBase64(iv), length: 64 }, secret, locked)
}

/** The kind of picture a file is by its first bytes, among those that are shown, and null for anything else. */
function pictureTypeOf(file: ArrayBuffer): string | null {
    const first = Array.from(new Uint8Array(file.slice(0, 12)), byte => String.fromCharCode(byte)).join('')
    if (first.startsWith('\xFF\xD8\xFF')) return 'image/jpeg'
    if (first.startsWith('\x89PNG\r\n\x1A\n')) return 'image/png'
    if (first.startsWith('GIF87a') || first.startsWith('GIF89a')) return 'image/gif'
    return first.startsWith('RIFF') && first.endsWith('WEBP') ? 'image/webp' : null
}

/** What a value holds by name, which is nothing unless it is an object. */
function recordOf(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
