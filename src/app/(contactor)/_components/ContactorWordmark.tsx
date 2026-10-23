type PropTypes = {
    light?: boolean,
}

export default function ContactorWordmark({ light = false }: PropTypes) {
    return (
        <span className={`
            font-contactor-heading! font-bold text-xl tracking-[-0.02em] whitespace-nowrap
            ${light ? 'text-white' : 'text-contactor-navy'}
        `}>
            Contactor
            <span className={`
                ml-[0.4em] text-[0.5em] font-semibold tracking-[0.15em] align-middle
                ${light ? 'text-contactor-yellow' : 'text-contactor-accent'}
            `}>
                NTNU
            </span>
        </span>
    )
}
