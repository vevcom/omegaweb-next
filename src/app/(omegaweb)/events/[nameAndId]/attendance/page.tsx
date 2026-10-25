import AttendanceScanner from './AttendanceScanner'
import AttendanceCountsPill from './AttendanceCountsPill'
import { AttendanceCountsProvider } from './AttendanceCounts'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import BackLink from '@/components/HeaderItems/BackLink'
import { eventOperations } from '@/services/events/operations'
import { eventRegistrationOperations } from '@/services/events/registration/operations'
import { omegaIdOperations } from '@/services/omegaid/operations'
import { decodeVevenUriHandleError, formatVevenUri } from '@/lib/urlEncoding'
import { serverPage } from '@/app/ServerPage'
import { notFound } from 'next/navigation'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    // readAttendanceCounts is what keeps those not administrating the event off the page.
    operation: async ({ params, session }: PageOperationArgs<{ nameAndId: string }>) => {
        if (!session.user) notFound()

        const event = await eventOperations.read({
            params: { id: decodeVevenUriHandleError(params.nameAndId) },
        })

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
                    <BackLink
                        href={`/events/${formatVevenUri(data.event.name, data.event.id)}`}
                        label={data.event.name}
                    />
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

export default page
export { generateMetadata }
