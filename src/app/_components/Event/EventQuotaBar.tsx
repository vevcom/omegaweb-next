function fillClassName(taken: number, places: number) {
    if (taken > places) return 'bg-error'
    return taken === places && places > 0 ? 'bg-success' : 'bg-primary'
}

/** How full a quota is. Over its places, as after a cut in them, it shows red. */
export default function EventQuotaBar({ taken, places }: { taken: number, places: number }) {
    const percent = places > 0 ? Math.min(100, taken / places * 100) : 0

    return <div
        role="img"
        aria-label={`${taken} av ${places} plasser er tatt`}
        className="h-2 rounded-full bg-base-300 overflow-hidden"
    >
        <div className={`
            h-full transition-[width] duration-300
            ${fillClassName(taken, places)}
        `} style={{ width: `${percent}%` }} />
    </div>
}
