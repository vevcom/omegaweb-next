import styles from './page.module.scss'

export const wrapperClassName = 'text-[40px] flex flex-col gap-2'

const part = 'bg-cover bg-no-repeat bg-top bg-fixed w-full'
export const frontImgPartClassName = `
    ${part}
    ${styles.frontImg}
    rounded-round overflow-hidden
`
export const omegamaiPartClassName = `
    ${part}
    ${styles.omegamai}
    py-4
`
export const taktlausePartClassName = `
    ${part}
    ${styles.taktlause}
    py-4
`
export const loggedInPartClassName = part

export const footerClassName = 'rounded-round overflow-hidden'

export const frontInfoClassName = (withPromoBar: boolean) => `
    w-full grid place-items-center bg-radial from-black to-transparent
    ${withPromoBar
        ? 'min-h-[calc(100dvh-56px-18*var(--gap))] max-mobile:min-h-[calc(100dvh-120px-19*var(--gap))]'
        : 'min-h-[calc(100dvh-56px-3*var(--gap))] max-mobile:min-h-[calc(100dvh-120px-4*var(--gap))]'}`

export const frontInfoInnerClassName = 'flex flex-col items-center gap-6 pb-[20px]'

export const scrollDownClassName = `
    text-white
    ${styles.scrollDown}
`
