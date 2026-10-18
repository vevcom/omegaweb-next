'use client'
import { qrCodeReaderConfig } from './constants'
import styles from './QrCodeReader.module.scss'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { useEffect, useEffectEvent, useId, useState } from 'react'

export type ScanResult = {
    success: boolean,
    text: string,
}

type PropTypes = {
    /**
     * Called with the text of every code read. What it returns is shown under the camera; null leaves
     * what is shown as it is, for a read the caller chose to ignore. A caller doing slow work for a
     * read (a request to the server) calls `showWaiting` before it, so the reader shows it is busy.
     */
    onScan: (text: string, showWaiting: () => void) => Promise<ScanResult | null>,
    /** Stops scanning after the first read that succeeds. */
    singleRead?: boolean,
    /** The size (in pixels) of the square the code is scanned within. */
    qrboxSize?: number,
}

/**
 * A camera feed that reads QR codes and shows the outcome of each read. What a code means is up to
 * the caller: OmegaIdReader reads OmegaId tokens with it, the locker page reads locker links.
 */
export default function QrCodeReader({ onScan, singleRead = false, qrboxSize }: PropTypes) {
    const [feedback, setFeedback] = useState<{
        status: 'EMPTY' | 'ERROR' | 'SUCCESS' | 'WAITING',
        text: string,
    }>({
        status: 'EMPTY',
        text: '',
    })

    const qrcodeRegionId = useId()
    // The scanner is set up once; a read always reaches the latest onScan.
    const scan = useEffectEvent((text: string, showWaiting: () => void) => onScan(text, showWaiting))

    useEffect(() => {
        const html5QrcodeScanner = new Html5QrcodeScanner(qrcodeRegionId, {
            ...qrCodeReaderConfig,
            // html5-qrcode rejects a box wider than the video, which a narrow phone would hit.
            ...(qrboxSize ? {
                qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
                    const size = Math.min(qrboxSize, viewfinderWidth, viewfinderHeight)
                    return { width: size, height: size }
                },
            } : {}),
        }, false)

        let reading = false
        html5QrcodeScanner.render(async text => {
            // The camera keeps reading while a read is handled; those reads are dropped.
            if (reading) return
            reading = true

            const result = await scan(text, () => setFeedback({ status: 'WAITING', text: '...' })).catch(() => ({
                success: false,
                text: 'Noe gikk galt. Prøv igjen.',
            }))
            reading = false
            // An ignored read leaves the outcome of the last one showing.
            if (result === null) return

            if (result.success && singleRead) {
                html5QrcodeScanner.clear().catch(() => {})
            }
            setFeedback({ status: result.success ? 'SUCCESS' : 'ERROR', text: result.text })
        }, () => {})

        return () => {
            html5QrcodeScanner.clear().catch(error => {
                console.error('Failed to clear html5QrcodeScanner. ', error)
            })
        }
    }, [qrcodeRegionId, qrboxSize, singleRead])

    return <div className={styles.QrCodeReader}>
        <div id={qrcodeRegionId} />

        <div className={`
            ${styles.feedbackBox}
            ${(feedback.status === 'SUCCESS' && !singleRead) ? styles.success : ''}
            ${feedback.status === 'ERROR' ? styles.error : ''}
            ${feedback.status === 'WAITING' ? styles.waiting : ''}
        `} >
            <span>{feedback.text}</span>
        </div>
    </div>
}
