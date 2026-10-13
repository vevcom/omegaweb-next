import ConnectStudentCardForm from './ConnectStudentCardForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { userAuth } from '@/services/users/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ newCard: string }>) => ({
        studentCard: params.newCard,
    }),
    capabilities: (data, session) => ({
        canConnectStudentCard: session.user
            ? userAuth.connectStudentCard.data({ userId: session.user.id })
            : Require.user(),
    }),
    metadata: () => ({ title: 'Registrer studentkort' }),
    render: ({ data: { studentCard }, capabilities, session }) => {
        if (!/^\d+$/.test(studentCard)) {
            return <p>Kortet er ikke gyldig. Det må være et heltall.</p>
        }

        return <PageWrapper
        >
            <p>Trykk på knappen under for å registrere kortet ditt: <b>{studentCard}</b></p>

            {capabilities.canConnectStudentCard.authorized && session.user && (
                <ConnectStudentCardForm studentCard={studentCard} userId={session.user.id} />
            )}
        </PageWrapper>
    },
})

export default page
export { generateMetadata }
