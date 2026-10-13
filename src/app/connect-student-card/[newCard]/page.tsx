import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { configureAction } from '@/services/configureAction'
import { connectStudentCardAction } from '@/services/users/actions'
import { userAuth } from '@/services/users/auth'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params }: PageOperationArgs<{ newCard: string }>) => ({
        cardParsed: parseInt(params.newCard, 10),
    }),
    capabilities: () => ({
        canConnectStudentCard: userAuth.connectStudentCard,
    }),
    metadata: () => ({ title: 'Registrer studentkort' }),
    render: ({ data: { cardParsed }, capabilities }) => {
        if (isNaN(cardParsed)) {
            return <p>Kortet er ikke gyldig. Det må være et heltall.</p>
        }

        return <PageWrapper
        >
            <p>Trykk på knappen under for å registrere kortet ditt: <b>{cardParsed}</b></p>

            {capabilities.canConnectStudentCard.authorized && (
                <Form
                    submitText="Registrer kort"
                    action={configureAction(connectStudentCardAction, {
                        params: {
                            studentCard: cardParsed
                        }
                    })}
                >
                </Form>
            )}
        </PageWrapper>
    },
})

export default page
export { generateMetadata }
