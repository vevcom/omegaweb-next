import { eventLinks } from '@/pageKits/events/links'
import AttendanceScanner from '@/components/Event/AttendanceScanner'
import SlotAttendance from '@/components/Event/SlotAttendance'
import AttendanceCountsPill from '@/components/Event/AttendanceCountsPill'
import { AttendanceCountsProvider } from '@/components/Event/AttendanceCounts'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import BackLink from '@/components/HeaderItems/BackLink'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { omegaIdOperations } from '@/services/omegaid/operations'
import { decodeVevenUriHandleError } from '@/lib/urlEncoding'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { PageOperationArgs } from '@/app/ServerPage'

/** Taking attendance at one event, rendered under `${path}/[nameAndId]/attendance` on both sites. */
export function eventAttendancePage(config: EventPagesConfig) {
    const links = eventLinks(config)
    return serverPage({
        // readAttendanceCounts is what keeps those not administrating the event off the page.
        operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
            if (!session.user) notFound()

            const event = await eventOperations.read({
                params: { id: decodeVevenUriHandleError(params.nameAndId), kinds: config.kindsToShow },
            })

            const counts = await eventRegistrationOperations.readAttendanceCounts({
                params: { eventId: event.id },
            })

            const slotted = event.variants.filter(variant => variant.registrationType === 'SLOTTED')
            const slotAttendance = await Promise.all(slotted.map(async variant => ({
                variant,
                attendance: await eventRegistrationOperations.readSlotAttendance({ params: { variantId: variant.id } }),
            })))

            const publicKey = await omegaIdOperations.readPublicKey({})

            return { event, counts, slotAttendance, publicKey, registeredById: session.user.id }
        },
        metadata: (data) => ({ title: `Oppmøte for ${data.event.name}` }),
        render: ({ data }) => (
            <AttendanceCountsProvider initialCounts={data.counts}>
                <PageWrapper headerItem={
                    <div className="flex justify-between items-center w-full gap-[1em]">
                        <BackLink href={links.event(data.event)} label={data.event.name} />
                        <AttendanceCountsPill />
                    </div>
                }>
                    <div className="flex flex-col gap-2 p-2 text-center">
                        <AttendanceScanner
                            eventId={data.event.id}
                            omegaIdPublicKey={data.publicKey}
                            registeredById={data.registeredById}
                        />
                        {data.slotAttendance.map(({ variant, attendance }) => <SlotAttendance
                            key={variant.id}
                            variantId={variant.id}
                            title={data.event.variants.length > 1 ? `Tidsluker, ${variant.name}` : 'Tidsluker'}
                            attendance={attendance}
                            registeredById={data.registeredById}
                        />)}
                    </div>
                </PageWrapper>
            </AttendanceCountsProvider>
        ),
    })
}
