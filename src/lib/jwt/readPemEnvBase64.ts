import '@pn-server-only'
import { ServiceError } from '@/services/error'

/**
 * PEM keys are stored in env vars as base64 rather than raw multi-line text.
 * Some platform env-var UIs (Dokploy included) don't reliably preserve a
 * literal `\n`-escaped value either - they auto-resolve escape sequences
 * back into real newlines when saving, which then breaks the .env file's
 * line-based format the same way an unescaped multi-line PEM does. Base64
 * has no newlines, backslashes, or quotes left for any UI to "helpfully"
 * reinterpret.
 */
export function readPemEnvBase64(value: string): string {
    const pem = Buffer.from(value, 'base64').toString('utf-8')

    if (!pem.startsWith('-----BEGIN ')) {
        throw new ServiceError(
            'INVALID CONFIGURATION',
            'A PEM env value must be the base64 encoding of a PEM key, not the PEM itself'
        )
    }

    return pem
}
