'use client'
import { useChatSession } from './ChatSessionProvider'
import Button from '@/components/UI/Button'
import type { ChatSessionState } from '@/lib/chatSession/run'

type SignedOutReason = (ChatSessionState & { status: 'SIGNED_OUT' })['reason']

const whySignedOut: Record<Exclude<SignedOutReason, 'NO_SESSION'>, string> = {
    ENDED: 'Du er logget ut av chatten i denne nettleseren.',
    REFUSED: 'Innloggingen på chatten ble avbrutt.',
    NOT_STARTED_HERE: 'Innloggingen på chatten ble ikke startet i denne fanen, eller den er alt brukt.',
    OTHER_ACCOUNT: 'Chatten logget inn en annen bruker enn deg, så innloggingen ble avvist. '
        + 'Logg inn på nytt, og velg å bruke en annen konto på chattens innloggingsside.',
}

/**
 * Where the browser's session with the chat stands, said to the user, with the way on where there
 * is one. Nothing while the client runs: what is shown then is the page's own.
 */
export default function ChatSessionStatus() {
    const { state, hasAccount, signIn, retry } = useChatSession()

    switch (state.status) {
        case 'STARTING':
            return <p className="m-0 text-base-content/80">Kobler til chatten ...</p>
        case 'WAITING_FOR_TAB':
            return (
                <p className="m-0">
                    Chatten er åpen i en annen fane i denne nettleseren. Den åpnes her når du lukker den fanen
                    eller går ut av chatten der.
                </p>
            )
        case 'SIGNING_IN':
            return <p className="m-0 text-base-content/80">Logger inn på chatten ...</p>
        case 'SIGNED_OUT':
            return <>
                <p className="m-0">
                    {state.reason !== 'NO_SESSION' && whySignedOut[state.reason]}
                    {state.reason === 'NO_SESSION' && (hasAccount
                        ? 'Du er ikke logget inn på chatten i denne nettleseren.'
                        : 'Du har ikke konto på chatten ennå. Du får en når du logger inn der, med samme innlogging som her.'
                    )}
                </p>
                <Button className="w-fit" onClick={signIn}>Logg inn på chatten</Button>
            </>
        case 'FAILED':
            return <>
                <p className="m-0">Får ikke kontakt med chatten akkurat nå.</p>
                <Button className="w-fit" onClick={retry}>Prøv igjen</Button>
            </>
        case 'RUNNING':
        default:
            return null
    }
}
