import styles from './page.module.scss'

// Separates the hero, the content and the footer by one grid step, so each reads as its own surface.
export const wrapperClassName = 'text-[40px] flex flex-col gap-2'

const part = 'bg-cover bg-no-repeat bg-top bg-fixed w-full'
// The hero's frontInfo paints its own radial gradient, so the corners are clipped rather than just rounded.
export const frontImgPartClassName = `${part} ${styles.frontImg} rounded-round overflow-hidden`
export const omegamaiPartClassName = `${part} ${styles.omegamai} py-4`
export const taktlausePartClassName = `${part} ${styles.taktlause} py-4`
export const loggedInPartClassName = part

export const footerClassName = 'rounded-round overflow-hidden'

// With a promo bar the hero shrinks by the bar's height plus the gap between them, so the two still fit.
export const frontInfoClassName = (withPromoBar: boolean) => [
    'w-full grid place-items-center bg-radial from-black to-transparent',
    withPromoBar
        ? 'min-h-[calc(100dvh-64px-18*var(--gap))] max-mobile:min-h-[calc(100dvh-128px-19*var(--gap))]'
        : 'min-h-[calc(100dvh-64px-3*var(--gap))] max-mobile:min-h-[calc(100dvh-128px-4*var(--gap))]',
].join(' ')

export const frontInfoInnerClassName = 'flex flex-col items-center gap-6 pb-[20px]'

export const scrollDownClassName = `text-white ${styles.scrollDown}`
