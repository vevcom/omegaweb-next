import { eventHref } from './eventPages'
import AttendanceScanner from '@/components/Event/AttendanceScanner'
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
import type { EventPagesConfig } from './eventPages'
import type { PageOperationArgs } from '@/app/ServerPage'

/** Taking attendance at one event, rendered under `${config.basePath}/[nameAndId]/attendance` on both sites. */
export const eventAttendancePage = (config: EventPagesConfig) => serverPage({
    // readAttendanceCounts is what keeps those not administrating the event off the page.
    operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
        if (!session.user) notFound()

        const event = await eventOperations.read({
            params: { id: decodeVevenUriHandleError(params.nameAndId) },
        })

        // The pages are fixed to the events carrying the locked tag; one without it is not found under them.
        if (config.lockedTag && !event.tags.some(tag => tag.special === config.lockedTag)) notFound()

        const counts = await eventRegistrationOperations.readAttendanceCounts({
            params: { eventId: event.id },
        })

        const publicKey = await omegaIdOperations.readPublicKey({})

        return { event, counts, publicKey, registeredById: session.user.id }
    },
    metadata: (data) => ({ title: `Oppmøte for ${data.event.name}` }),
    render: ({ data }) => (
        <AttendanceCountsProvider initialCounts={data.counts}>
            <PageWrapper headerItem={
                <div className="flex justify-between items-center w-full gap-[1em]">
                    <BackLink href={eventHref(config.basePath, data.event)} label={data.event.name} />
                    <AttendanceCountsPill />
                </div>
            }>
                <div className="flex flex-col gap-2 p-2 text-center">
                    <AttendanceScanner
                        eventId={data.event.id}
                        omegaIdPublicKey={data.publicKey}
                        registeredById={data.registeredById}
                    />
                </div>
            </PageWrapper>
        </AttendanceCountsProvider>
    ),
})
