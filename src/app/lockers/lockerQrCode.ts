/**
 * The locker page a scanned QR code points at, or null if it points anywhere else. The codes on the
 * lockers hold a link to the locker's page on this site; whatever host the link names, only the path
 * is used, and only when it is a locker's. Nothing else a code may hold - another site, another page
 * here, a javascript: link - is navigated to.
 */
export function lockerPathOfQrCode(text: string, origin: string): string | null {
    try {
        const url = new URL(text.trim(), origin)
        const match = /^\/lockers\/(\d+)\/?$/.exec(url.pathname)
        return match ? `/lockers/${Number(match[1])}` : null
    } catch {
        return null
    }
}
