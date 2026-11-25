/**
 * Compares the provided secret with the stored one in time that depends only on the longer length,
 * never on where they first differ, so no secret is leaked through timing. Written out rather than
 * crypto's timingSafeEqual, since rules that use it are shared with the client, where Node's crypto
 * would be polyfilled with code the content security policy refuses.
 */
export function secretsMatch(provided: string, stored: string): boolean {
    const length = Math.max(provided.length, stored.length)
    const difference = Array.from({ length }, (nothing, index) => index).reduce(
        (accumulated, index) => accumulated | ((provided.charCodeAt(index) || 0) ^ (stored.charCodeAt(index) || 0)),
        provided.length ^ stored.length,
    )
    return difference === 0
}
