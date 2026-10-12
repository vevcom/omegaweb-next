import PageTitleSetter from '@/contexts/PageTitleSetter'
import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { configureAction } from '@/services/configureAction'
import { connectStudentCardAction } from '@/services/users/actions'


export default async function ConnectStucentCard({ params }: { params: Promise<{ newCard: string }> }) {
    const newCard = (await params).newCard

    const cardParsed = parseInt(newCard, 10)

    if (isNaN(cardParsed)) {
        return <p>Kortet er ikke gyldig. Det må være et heltall.</p>
    }


    return <PageWrapper
    >
        <PageTitleSetter title="Registrer studentkort" />
        <p>Trykk på knappen under for å registrere kortet ditt: <b>{cardParsed}</b></p>

        <Form
            submitText="Registrer kort"
            action={configureAction(connectStudentCardAction, {
                params: {
                    studentCard: cardParsed
                }
            })}
        >
        </Form>
    </PageWrapper>
}
