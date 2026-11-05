'use client'
import { osloDateTime } from '@/lib/dates/oslo'
import { displayDuration, filledAt, registrationBuckets, timeToFillMs } from '@/services/events/statistics'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { BucketUnit, VariantStatistics } from '@/services/events/statistics'

const CHART_HEIGHT = 220
const MARGIN = { top: 16, right: 12, bottom: 24, left: 32 }
const MAX_BAR_WIDTH = 24
const BAR_GAP = 2
const BAR_RADIUS = 4
const MIN_TIME_SPAN_MS = 60 * 1000
const TOOLTIP_INSET = 70

const bucketFormats: Record<BucketUnit, string> = { hour: 'd. LLL HH:mm', day: 'd. LLL', week: "'uke' W" }
const bucketNames: Record<BucketUnit, string> = { hour: 'time', day: 'dag', week: 'uke' }

function displayMoment(date: Date, format = 'd. LLL HH:mm') {
    return osloDateTime(date).setLocale('nb').toFormat(format)
}

/** Whole-number ticks at a round step, from zero to past the highest value. */
function roundTicks(highest: number) {
    const rough = Math.max(highest, 1) / 4
    const magnitude = 10 ** Math.floor(Math.log10(rough))
    const step = Math.max(1, [1, 2, 5, 10].map(factor => factor * magnitude).find(option => option >= rough) ?? rough)
    const ticks = [0]
    while (ticks[ticks.length - 1] < highest) ticks.push(ticks[ticks.length - 1] + step)
    return ticks
}

function Tile({ label, value, detail }: { label: string, value: ReactNode, detail?: string }) {
    return <div className="flex flex-col gap-1 p-3 rounded-inner bg-surface-raised">
        <span className="text-s text-text-muted">{label}</span>
        <span className="text-l font-bold">{value}</span>
        {detail && <span className="text-s text-text-muted">{detail}</span>}
    </div>
}

/** A chart that fits its width, which only exists once its tab is shown, with the gridlines of its y axis. */
function Chart({ title, label, ticks, tooltip, children, onPointerMove, onPointerLeave }: {
    title: string,
    label: string,
    ticks: number[],
    /** Where to point, as a fraction of the plot width. */
    tooltip: { at: number, content: ReactNode } | null,
    children: (plot: { width: number, height: number, y: (value: number) => number }) => ReactNode,
    onPointerMove?: (x: number, plotWidth: number) => void,
    onPointerLeave?: () => void,
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(0)

    useEffect(() => {
        const container = containerRef.current
        if (!container) return undefined
        const observer = new ResizeObserver(() => setContainerWidth(container.clientWidth))
        observer.observe(container)
        return () => observer.disconnect()
    }, [])

    const width = Math.max(containerWidth - MARGIN.left - MARGIN.right, 0)
    const height = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
    const y = (value: number) => height - value / ticks[ticks.length - 1] * height

    return <figure className="m-0 flex flex-col gap-2">
        <figcaption className="font-medium">{title}</figcaption>
        <div ref={containerRef} className="relative">
            <svg
                role="img"
                aria-label={label}
                width={containerWidth}
                height={CHART_HEIGHT}
                className="block touch-pan-y"
                onPointerMove={event => {
                    const bounds = event.currentTarget.getBoundingClientRect()
                    onPointerMove?.(event.clientX - bounds.left - MARGIN.left, width)
                }}
                onPointerLeave={onPointerLeave}
            >
                <g transform={`translate(${MARGIN.left} ${MARGIN.top})`}>
                    {ticks.map(tick => <g key={tick}>
                        <line x1={0} x2={width} y1={y(tick)} y2={y(tick)} className="stroke-surface-subtle" />
                        <text x={-8} y={y(tick) + 4} textAnchor="end" className="fill-text-muted text-s tabular-nums">
                            {tick}
                        </text>
                    </g>)}
                    {children({ width, height, y })}
                </g>
            </svg>
            {tooltip && <div
                style={{
                    left: Math.min(
                        Math.max(MARGIN.left + tooltip.at * width, TOOLTIP_INSET),
                        containerWidth - TOOLTIP_INSET,
                    ),
                }}
                className="
                    absolute top-0 -translate-x-1/2 flex flex-col px-2 py-1 rounded-inner bg-surface-base border
                    border-surface-subtle pointer-events-none whitespace-nowrap
                "
            >
                {tooltip.content}
            </div>}
        </div>
    </figure>
}

function CumulativeChart({ statistics }: { statistics: VariantStatistics }) {
    const { registeredAt, registrationStart, places } = statistics
    const [hovered, setHovered] = useState<number | null>(null)
    const total = registeredAt.length
    const first = Math.min(registrationStart.getTime(), registeredAt[0].getTime())
    const span = Math.max(registeredAt[total - 1].getTime() - first, MIN_TIME_SPAN_MS)
    const filled = filledAt(statistics)
    const ticks = roundTicks(Math.max(total, places))
    const fraction = (date: Date) => (date.getTime() - first) / span

    const hoveredAt = hovered === null ? null : registeredAt[hovered]
    return <Chart
        title="Påmeldinger over tid"
        label={`Påmeldte: ${total} fra ${displayMoment(new Date(first))} til ${
            displayMoment(registeredAt[total - 1])
        }, med ${places} plasser`}
        ticks={ticks}
        tooltip={hoveredAt && hovered !== null ? {
            at: fraction(hoveredAt),
            content: <>
                <strong>{hovered + 1} påmeldt</strong>
                <span className="text-s text-text-muted">{displayMoment(hoveredAt)}</span>
            </>,
        } : null}
        onPointerMove={(x, plotWidth) => {
            const moment = first + x / plotWidth * span
            let nearest = 0
            registeredAt.forEach((date, index) => {
                const distance = Math.abs(date.getTime() - moment)
                if (distance < Math.abs(registeredAt[nearest].getTime() - moment)) nearest = index
            })
            setHovered(nearest)
        }}
        onPointerLeave={() => setHovered(null)}
    >
        {({ width, height, y }) => {
            const x = (date: Date) => fraction(date) * width
            const steps = registeredAt.map((date, index) => `H${x(date)}V${y(index + 1)}`).join('')
            const line = `M0 ${y(0)}${steps}`
            return <>
                <path d={`${line}V${height}Z`} className="fill-accent-blue/10" />
                {places > 0 && <>
                    <line x1={0} x2={width} y1={y(places)} y2={y(places)} className="stroke-text-muted" />
                    <text x={4} y={y(places) - 4} className="fill-text-muted text-s">{places} plasser</text>
                </>}
                <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" className="stroke-accent-blue" />
                {filled && <circle
                    cx={x(filled)}
                    cy={y(registeredAt.filter(date => date <= filled).length)}
                    r={5}
                    strokeWidth={2}
                    className="fill-accent-blue stroke-surface-base"
                />}
                {hoveredAt && hovered !== null && <>
                    <line x1={x(hoveredAt)} x2={x(hoveredAt)} y1={0} y2={height} className="stroke-text-muted" />
                    <circle
                        cx={x(hoveredAt)}
                        cy={y(hovered + 1)}
                        r={5}
                        strokeWidth={2}
                        className="fill-accent-blue stroke-surface-base"
                    />
                </>}
                <text y={height + 18} className="fill-text-muted text-s">{displayMoment(new Date(first))}</text>
                <text x={width} y={height + 18} textAnchor="end" className="fill-text-muted text-s">
                    {displayMoment(registeredAt[total - 1])}
                </text>
            </>
        }}
    </Chart>
}

function BucketChart({ statistics }: { statistics: VariantStatistics }) {
    const { unit, buckets } = registrationBuckets(statistics)
    const [hovered, setHovered] = useState<number | null>(null)
    const highest = Math.max(...buckets.map(bucket => bucket.count))
    const hoveredBucket = hovered === null ? undefined : buckets[hovered]

    return <Chart
        title={`Påmeldinger per ${bucketNames[unit]}`}
        label={`Flest påmeldinger på én ${bucketNames[unit]} var ${highest}`}
        ticks={roundTicks(highest)}
        tooltip={hoveredBucket && hovered !== null ? {
            at: (hovered + 0.5) / buckets.length,
            content: <>
                <strong>{hoveredBucket.count} påmeldt</strong>
                <span className="text-s text-text-muted">{displayMoment(hoveredBucket.start, bucketFormats[unit])}</span>
            </>,
        } : null}
        onPointerMove={(x, plotWidth) => setHovered(
            Math.min(Math.max(Math.floor(x / plotWidth * buckets.length), 0), buckets.length - 1)
        )}
        onPointerLeave={() => setHovered(null)}
    >
        {({ width, height, y }) => {
            const slot = width / buckets.length
            const barWidth = Math.max(Math.min(MAX_BAR_WIDTH, slot - BAR_GAP), 1)
            return <>
                {buckets.map((bucket, index) => {
                    if (bucket.count === 0) return null
                    const left = index * slot + (slot - barWidth) / 2
                    const top = y(bucket.count)
                    const radius = Math.min(BAR_RADIUS, barWidth / 2, height - top)
                    return <g key={bucket.start.getTime()}>
                        <path
                            d={`M${left} ${height}V${top + radius}Q${left} ${top} ${left + radius} ${top}
                                H${left + barWidth - radius}Q${left + barWidth} ${top} ${left + barWidth} ${top + radius}
                                V${height}Z`}
                            className={`
                                fill-accent-blue
                                ${hovered === index ? 'opacity-80' : ''}
                            `}
                        />
                        {bucket.count === highest && <text
                            x={left + barWidth / 2}
                            y={top - 4}
                            textAnchor="middle"
                            className="fill-text-muted text-s"
                        >{highest}</text>}
                    </g>
                })}
                <text y={height + 18} className="fill-text-muted text-s">
                    {displayMoment(buckets[0].start, bucketFormats[unit])}
                </text>
                {buckets.length > 1 && <text x={width} y={height + 18} textAnchor="end" className="fill-text-muted text-s">
                    {displayMoment(buckets[buckets.length - 1].start, bucketFormats[unit])}
                </text>}
            </>
        }}
    </Chart>
}

function VariantSection({ statistics, showName }: { statistics: VariantStatistics, showName: boolean }) {
    const { registeredAt, places, inQuota, waiting, paid, attended } = statistics
    const fillTime = timeToFillMs(statistics)
    const { unit, buckets } = registrationBuckets(statistics)

    return <section className="flex flex-col gap-4">
        {showName && <h3 className="m-0">{statistics.name}</h3>}
        <div className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
            {places > 0 && <Tile
                label="Fylt på"
                value={fillTime === null ? 'Ikke fullt' : displayDuration(fillTime)}
                detail={fillTime === null ? undefined : 'fra påmeldingen åpnet'}
            />}
            <Tile label="Påmeldte" value={`${inQuota} av ${places}`} />
            <Tile label="Venteliste" value={waiting} />
            {paid !== null && <Tile label="Betalt" value={`${paid} av ${inQuota}`} />}
            {attended > 0 && <Tile label="Oppmøte" value={`${attended} av ${inQuota}`} />}
        </div>
        {registeredAt.length === 0 ? <p className="m-0 text-text-muted">Ingen er påmeldt ennå.</p> : <>
            <CumulativeChart statistics={statistics} />
            <BucketChart statistics={statistics} />
            <details>
                <summary className="cursor-pointer">Vis som tabell</summary>
                <table className="w-full mt-2 tabular-nums">
                    <thead>
                        <tr>
                            <th className="text-left font-medium">Tidspunkt</th>
                            <th className="text-right font-medium">Påmeldt</th>
                        </tr>
                    </thead>
                    <tbody>
                        {buckets.filter(bucket => bucket.count > 0).map(bucket => <tr key={bucket.start.getTime()}>
                            <td>{displayMoment(bucket.start, bucketFormats[unit])}</td>
                            <td className="text-right">{bucket.count}</td>
                        </tr>)}
                    </tbody>
                </table>
            </details>
        </>}
    </section>
}

/** How registration went, per variant. Nothing here can be changed, so it sits outside the form. */
export default function EventStatistics({ variants }: { variants: VariantStatistics[] }) {
    return <div className="flex flex-col gap-6 pb-4">
        {variants.map(variant => <VariantSection
            key={variant.id}
            statistics={variant}
            showName={variants.length > 1}
        />)}
        <p className="m-0 text-s text-text-muted">
            Regnet ut fra dem som fortsatt er påmeldt. De som har meldt seg av telles ikke, så plassene kan ha gått
            raskere enn det ser ut.
        </p>
    </div>
}
