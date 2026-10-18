'use client'
import QrCodeReader from '@/components/QrCodeReader/QrCodeReader'
import { parseJWTClient } from '@/jwt/parseJWTClient'
import { decompressOmegaId } from '@/services/omegaid/compress'
import { useRef } from 'react'
import type { ScanResult } from '@/components/QrCodeReader/QrCodeReader'
import type { Awaitable } from '@/lib/awaitable'

/**
 * Renders a component for reading OmegaId QR codes.
 *
 * @param successCallback - A callback function that will be called when a valid QR code is scanned.
 *                          It receives the user data and the token as parameters.
 * @param publicKey - The public key used for verifying the QR code token.
 *                    Use the action readOmegaIdPublicKey() to read the public key
 * @param expiryOffset - An optional offset (in seconds) to adjust the expiry time of the QR code token.
 * @param debounceThreshold - An optional threshold (in milliseconds) to prevent duplicate reads.
 * @param singleRead - An optional flag indicating whether only a single QR code should be read.
 * @param qrboxSize - An optional size (in pixels) of the square the QR code is scanned within.
 * @returns The rendered component for reading OmegaId QR codes.
 */
export default function OmegaIdReader({
    successCallback,
    publicKey,
    expiryOffset,
    debounceThreshold,
    singleRead,
    qrboxSize,
}: {
    successCallback: (user: number, token: string) => Awaitable<ScanResult>,
    publicKey: string,
    expiryOffset?: number,
    debounceThreshold?: number,
    singleRead?: boolean,
    qrboxSize?: number,
}) {
    const lastRead = useRef({ userId: -1, time: 0 })

    const handleScan = async (rawToken: string, showWaiting: () => void): Promise<ScanResult | null> => {
        const token = decompressOmegaId(rawToken)
        if (!token.success) {
            return { success: false, text: 'Ugyldig QR kode' }
        }
        const parse = await parseJWTClient(token.data, publicKey, expiryOffset ?? 100, 'omegaid')
        if (!parse.success) {
            return {
                success: false,
                text: parse.error?.map(error => error.message).join(' / ') ?? 'Ukjent feil',
            }
        }

        const userId = parse.data
        // The same code held in front of the camera is read over and over; only the first counts.
        if (userId === lastRead.current.userId && Date.now() - lastRead.current.time < (debounceThreshold ?? 5000)) {
            lastRead.current.time = Date.now()
            return null
        }

        showWaiting()
        const result = await successCallback(userId, token.data)
        lastRead.current = { userId, time: Date.now() }
        return result
    }

    return <QrCodeReader onScan={handleScan} singleRead={singleRead} qrboxSize={qrboxSize} />
}
