type PropTypes = {
    light?: boolean,
}

export default function CareersWordmark({ light = false }: PropTypes) {
    return (
        <span className={`
            font-careers-heading! font-bold text-xl tracking-[-0.02em] whitespace-nowrap
            ${light ? 'text-white' : 'text-careers-navy'}
        `}>
            Contactor
            <span className={`
                ml-[0.4em] text-[0.5em] font-semibold tracking-[0.15em] align-middle
                ${light ? 'text-careers-yellow' : 'text-careers-accent'}
            `}>
                NTNU
            </span>
        </span>
    )
}
