import ConnectStudentCardForm from './ConnectStudentCardForm'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { userAuth } from '@/services/users/auth'
import { userOperations } from '@/services/users/operations'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ newCard: string }>) => ({
        studentCard: params.newCard,
        currentStudentCard: session.user
            ? (await userOperations.read({ params: { id: session.user.id } })).studentCard
            : null,
    }),
    capabilities: (data, session) => ({
        canConnectStudentCard: session.user
            ? userAuth.connectStudentCard.data({ userId: session.user.id })
            : Require.user(),
    }),
    metadata: () => ({ title: 'Registrer studentkort' }),
    render: ({ data: { studentCard, currentStudentCard }, capabilities, session }) => {
        if (!/^\d+$/.test(studentCard)) {
            return <p>Kortet er ikke gyldig. Det må være et heltall.</p>
        }

        return <PageWrapper
        >
            <p>Trykk på knappen under for å registrere kortet ditt: <b>{studentCard}</b></p>

            {capabilities.canConnectStudentCard.authorized && session.user && (
                <ConnectStudentCardForm
                    studentCard={studentCard}
                    currentStudentCard={currentStudentCard}
                    userId={session.user.id}
                />
            )}
        </PageWrapper>
    },
})

export default page
export { generateMetadata }
