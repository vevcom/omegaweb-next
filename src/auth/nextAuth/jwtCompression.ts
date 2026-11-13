import logger from '@/lib/logger'
import { deflate, inflate } from 'zlib'
import { promisify } from 'util'
import type { JWT } from 'next-auth/jwt'

// THIS WACKY COMPRESSING AND DECOMPRESSING STUFF IS TEMPORARY
// TO REDUCE JWT SIZE UNTIL WE HAVE EITHER:
// 1) MORE REASONABLE PERMISSIONS ENCODING
// 2) SWITCHED TO DATABASE SESSIONS
// 3) FIX THE JWT TYPE TO SUPPORT COMPRESSION PROPERLY

const deflateAsync = promisify(deflate)
const inflateAsync = promisify(inflate)

// eslint-disable-next-line
async function compressField(data: any): Promise<any> {
    try {
        const buffer = await deflateAsync(JSON.stringify(data))
        return buffer.toString('base64')
    } catch (error) {
        logger.error('Failed to compress JWT field.', { error })

        return null
    }
}

/** What a field decompressed to, kept apart from a failure: the user of a company session is null. */
type Decompressed = { success: true, value: unknown } | { success: false }

async function decompressField(data: unknown): Promise<Decompressed> {
    if (typeof data !== 'string') {
        logger.error('Failed to decompress JWT field: it is not a string.')

        return { success: false }
    }

    try {
        const buffer = Buffer.from(data, 'base64')
        const inflated = await inflateAsync(buffer)
        return { success: true, value: JSON.parse(inflated.toString()) as unknown }
    } catch (error) {
        logger.error('Failed to decompress JWT field.', { error })

        return { success: false }
    }
}

const fieldsToCompress: (keyof JWT)[] = ['permissions', 'memberships', 'user', 'companyUser']

export async function compressJwt(token: JWT | undefined): Promise<JWT | undefined> {
    if (!token) return token

    const compressedJwt = { ...token }

    for (const field of fieldsToCompress) {
        if (field in compressedJwt) {
            compressedJwt[field] = await compressField(compressedJwt[field])
        }
    }

    return compressedJwt
}

export async function decompressJwt(token: JWT): Promise<JWT | null> {
    const decompressedJwt = { ...token }

    for (const field of fieldsToCompress) {
        if (field in decompressedJwt) {
            const decompressedField = await decompressField(decompressedJwt[field])

            if (!decompressedField.success) {
                return null
            }

            // The field was compressed by compressField, so it is trusted to have the type JWT declares for it.
            Object.assign(decompressedJwt, { [field]: decompressedField.value })
        }
    }

    return decompressedJwt
}
