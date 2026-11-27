import EventInfoRow from './EventInfoRow'
import EventSection from './EventSection'
import { ClassLevelConfig } from '@/services/groups/constants'
import { displaySlot, onOneDay, slotClock, slotDay } from '@/services/events/slots/display'
import type { CompanySchedule, SlotHolderForCompany } from '@/services/events/slots/types'

function HolderDetails({ holder }: { holder: SlotHolderForCompany }) {
    const study = [
        holder.class && ClassLevelConfig[holder.class].name,
        ...holder.studyProgrammes,
    ].filter(Boolean).join(' · ')
    return <span className="flex flex-col min-w-0">
        <span className="font-semibold">{holder.name}</span>
        <span className="text-s text-base-content/80 wrap-anywhere">
            {holder.email && <a href={`mailto:${holder.email}`}>{holder.email}</a>}
            {holder.email && study && ' · '}
            {study}
        </span>
    </span>
}

function VariantSchedule({ schedule }: { schedule: CompanySchedule }) {
    const { slots, waiting } = schedule
    if (slots.length === 0) return <p className="m-0 text-base-content/80">Varianten har ingen tidsluker ennå.</p>
    const oneDay = onOneDay(slots)
    const nobody = waiting === 0 && slots.every(slot => slot.holder === null)

    return <>
        {nobody && <p className="m-0 text-base-content/80">Ingen har meldt seg på ennå.</p>}
        {oneDay && <p className="m-0 text-s text-base-content/80">{slotDay(slots[0].start)}</p>}
        <ol className="m-0 p-0 list-none flex flex-col gap-1">
            {slots.map(slot => <li key={slot.id} className="
                grid grid-cols-[8rem_1fr] items-baseline gap-2 px-3 py-1 rounded-inner bg-base-200
                max-mobile:grid-cols-1 max-mobile:gap-0
            ">
                <span className="tabular-nums">{oneDay ? slotClock(slot) : displaySlot(slot)}</span>
                {slot.holder ? <HolderDetails holder={slot.holder} /> : <span className="text-base-content/60">Ledig</span>}
            </li>)}
        </ol>
        <EventInfoRow label="På venteliste">{waiting}</EventInfoRow>
    </>
}

/**
 * The schedule of each slotted variant as the company of the event sees it: each slot in Oslo time
 * with who holds it, and how many wait. The variants are named when the event has several.
 */
export default function CompanySlotSchedule({ variants, namesVariants }: {
    variants: { id: number, name: string, schedule: CompanySchedule }[],
    namesVariants: boolean,
}) {
    if (variants.length === 0) {
        return <EventSection title="Timeplan">
            <p className="text-base-content/80">Arrangementet har ingen påmelding til tidsluker ennå.</p>
        </EventSection>
    }
    return <>
        {variants.map(variant => <EventSection
            key={variant.id}
            title={namesVariants ? `Timeplan, ${variant.name}` : 'Timeplan'}
        >
            <VariantSchedule schedule={variant.schedule} />
        </EventSection>)}
    </>
}
