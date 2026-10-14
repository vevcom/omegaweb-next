import { Karla, Sora } from 'next/font/google'

// contactor.no's fonts: Karla for text, Sora for headings. The career layout puts both classes on
// its root so the variables are set there and nowhere else.
export const karla = Karla({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--contactor-font-sans',
})

export const sora = Sora({
    subsets: ['latin'],
    weight: ['500', '600', '700'],
    variable: '--contactor-font-heading',
})
