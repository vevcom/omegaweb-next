import { JWT_ISSUER } from '@/lib/jwt/constants'
import type { ActionReturn, ActionError } from '@/services/actionTypes'
import type { OmegaIdJWT } from '@/services/omegaid/types'

export function compressOmegaId(token: string): string {
    const parts = token.split('.')
    const payloadCompressed = compressPayload(parts[1])
    const payload = base64ToBigInt(payloadCompressed)
    const sign = base64ToBigInt(parts[2])
    const ret = `${payload}.${sign}`
    return ret
}

function decodeBase64Url(base64: string) {
    return atob(base64.replaceAll('-', '+').replaceAll('_', '/'))
}

function encodeBase64Url(data: string): string {
    return btoa(data).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64ToBigInt(base64: string): string {
    const binaryString = decodeBase64Url(base64)
    let bigint = BigInt(0)

    // Convert binary string to BigInt
    for (let i = 0; i < binaryString.length; i++) {
        bigint = (bigint << BigInt(8)) | BigInt(binaryString.charCodeAt(i))
    }

    return bigint.toString()
}

function bigIntToBase64(bigIntString: string): string {
    let bigInt = BigInt(bigIntString)
    let binaryString = ''

    while (bigInt > BigInt(0)) {
        const nextChar = bigInt & BigInt(0xFF)
        binaryString += String.fromCharCode(Number(nextChar))
        bigInt >>= BigInt(8)
    }

    binaryString = binaryString.split('').reverse().join('')

    return encodeBase64Url(binaryString)
}

function compressPayload(payload: string): string {
    const binaryString = decodeBase64Url(payload)
    const payloadString = binaryString.toString()
    const payloadJSON = JSON.parse(payloadString) as OmegaIdJWT
    const shortPayloadString = `${payloadJSON.sub},${payloadJSON.iat},${payloadJSON.exp}`
    return encodeBase64Url(shortPayloadString)
}

function decompressPayload(rawdata: string): string {
    const base64String = bigIntToBase64(rawdata)
    const byteString = decodeBase64Url(base64String)
    const dataString = byteString.toString().split(',')
    const payload = {
        sub: Number(dataString[0]),
        iat: Number(dataString[1]),
        exp: Number(dataString[2]),
        aud: 'omegaid',
        iss: JWT_ISSUER,
    }
    const payloadString = JSON.stringify(payload)

    return encodeBase64Url(payloadString)
}

export function decompressOmegaId(rawdata: string): ActionReturn<string> {
    const header = {
        alg: 'ES256',
        typ: 'JWT'
    }
    const headerJSONString = JSON.stringify(header)
    const headerB64String = encodeBase64Url(headerJSONString)

    const errorReturn: ActionError = {
        success: false,
        errorCode: 'JWT INVALID',
        httpCode: 400,
        error: [{
            message: 'QR-koden er ikke en Omega-ID',
        }],
    }

    const rawDataSplit = rawdata.split('.')
    if (rawDataSplit.length !== 2) {
        return errorReturn
    }

    try {
        const payload = decompressPayload(rawDataSplit[0])

        const signature = bigIntToBase64(rawDataSplit[1])

        return {
            success: true,
            data: `${headerB64String}.${payload}.${signature}`,
        }
    } catch {
        return errorReturn
    }
}
