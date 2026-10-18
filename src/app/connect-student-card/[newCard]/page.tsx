import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { configureAction } from '@/services/configureAction'
import { connectStudentCardAction } from '@/services/users/actions'
import { userAuth } from '@/services/users/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: ({ params }: PageOperationArgs<{ newCard: string }>) => ({
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
                <Form
                    submitText="Registrer kort"
                    action={configureAction(connectStudentCardAction, {
                        params: {
                            id: session.user.id
                        }
                    })}
                >
                    <input type="hidden" name="studentCard" value={studentCard} />
                </Form>
            )}
        </PageWrapper>
    },
})

export default page
export { generateMetadata }
