'use client'
import styles from './LockerScanner.module.scss'
import { lockerPathOfQrCode } from './lockerQrCode'
import QrCodeReader from '@/components/QrCodeReader/QrCodeReader'
import { ScanHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import { useRouter } from 'next/navigation'

/**
 * Opens the camera in a pop-up and goes to the locker whose QR code is held in front of it.
 */
export default function LockerScanner() {
    const router = useRouter()

    return (
        <ScanHeaderItemPopUp popUpKey="scan_locker_qr_code">
            <div className={styles.LockerScanner}>
                <h2>Skann QR-koden på skapet</h2>
                <QrCodeReader
                    singleRead
                    qrboxSize={250}
                    onScan={text => {
                        const path = lockerPathOfQrCode(text, window.location.origin)
                        if (!path) {
                            return { success: false, text: 'QR-koden er ikke til et skap' }
                        }
                        router.push(path)
                        return { success: true, text: 'Skap funnet' }
                    }}
                />
            </div>
        </ScanHeaderItemPopUp>
    )
}
