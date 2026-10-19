import type { Html5QrcodeScannerConfig } from 'html5-qrcode/esm/html5-qrcode-scanner'

export const qrCodeReaderConfig: Html5QrcodeScannerConfig = {
    fps: 4,
    disableFlip: true,
    qrbox: {
        width: 200,
        height: 200,
    },
    aspectRatio: 1,
}
