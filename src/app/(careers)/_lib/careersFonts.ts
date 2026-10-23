import localFont from 'next/font/local'

export const karla = localFont({
    src: './fonts/karla-latin.woff2',
    weight: '200 800',
    display: 'swap',
    variable: '--careers-font-sans',
})

export const sora = localFont({
    src: './fonts/sora-latin.woff2',
    weight: '100 800',
    display: 'swap',
    variable: '--careers-font-heading',
})
