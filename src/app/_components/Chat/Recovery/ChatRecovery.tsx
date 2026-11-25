'use client'
import { NO_KEY_SHOWN, keyShownAfter } from './keyShown'
import { refusalWording } from '@/components/Chat/Membership/chatAction'
import { useChatSession } from '@/components/Chat/Session/ChatSessionProvider'
import Form from '@/components/Form/Form'
import Button from '@/components/UI/Button'
import TextInput from '@/components/UI/TextInput'
import { refusalOf } from '@/lib/chatSession/membership'
import { RecoveryIsSetUp, RecoveryUnfinished, WrongRecoveryKey, watchRecovery } from '@/lib/chatSession/recovery'
import { createActionError } from '@/services/actionError'
import { useMemo, useState, useSyncExternalStore } from 'react'
import type { Recovery, WatchedRecovery } from '@/lib/chatSession/recovery'
import type { ActionReturn } from '@/services/actionTypes'
import type { MatrixClient } from 'matrix-js-sdk'

const KEY_FIELD = 'recoveryKey'
const WRONG_KEY = 'Det er ikke gjenopprettingsnøkkelen din. Sjekk at du har fått med alle tegnene.'
const IS_SET_UP = 'Kontoen din er alt satt opp for kryptering et annet sted, så det ble ikke laget noen nøkkel her.'
const UNFINISHED = 'Nøkkelen er laget, men oppsettet ble ikke ferdig. Lagre nøkkelen, og fullfør oppsettet under.'

/**
 * Where the user makes their recovery key, is shown it once, and gives it to a new browser. It
 * is said for one who has never heard of a key what it is for and what is lost without it. A
 * key whose setting up was not finished is shown all the same, since it may be the account's
 * already, with the way to finish.
 * Nothing is shown to one who is not signed in to the chat here, or who has nothing encrypted.
 */
export default function ChatRecovery() {
    const { state } = useChatSession()
    return state.status === 'RUNNING' ? <RecoveryOf client={state.client} /> : null
}

function RecoveryOf({ client }: { client: MatrixClient }) {
    const watched = useMemo(() => watchRecovery(client), [client])
    const recovery = useSyncExternalStore(watched.subscribe, watched.read)
    const [{ made, isLetGo }, setShown] = useState(NO_KEY_SHOWN)
    const setUp = () => watched.setUp().then(
        recoveryKey => setShown(before => keyShownAfter(before, { recoveryKey })),
        (error: unknown) => {
            setShown(before => keyShownAfter(before, { error }))
            throw error
        },
    )

    if (made === null && !isLetGo && (recovery === 'LOOKING' || recovery === 'NOTHING_ENCRYPTED')) return null
    return (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">Krypterte samtaler</h2>
            {isLetGo && (
                <p role="alert" className="m-0 text-error">
                    Kontoen din har alt en gjenopprettingsnøkkel, som ble laget et annet sted mens oppsettet her
                    sto uferdig. Nøkkelen som ble vist her, ble aldri din og virker ikke. Ikke ta vare på den.
                </p>
            )}
            {made === null
                ? <RecoveryState recovery={recovery} onSetUp={setUp} onEnter={watched.enter} />
                : <MadeKey {...made} onSetUp={setUp} onSaved={() => setShown(NO_KEY_SHOWN)} />}
        </div>
    )
}

type MadePropTypes = {
    recoveryKey: string,
    /** Whether the key is set up. One that is not is shown with the way to finish. */
    isSetUp: boolean,
    onSetUp: () => Promise<void>,
    onSaved: () => void,
}

function MadeKey({ recoveryKey, isSetUp, onSetUp, onSaved }: MadePropTypes) {
    const [isCopied, setIsCopied] = useState(false)
    const copy = () => void navigator.clipboard.writeText(recoveryKey).then(() => setIsCopied(true), () => undefined)

    return <>
        <p className="m-0">
            Dette er gjenopprettingsnøkkelen din. Den vises bare nå. Skriv den ned, eller lagre den et trygt
            sted, for eksempel der du lagrer passordene dine. Mister du den, kan ingen hente den fram igjen,
            heller ikke vi som driver chatten.
        </p>
        <code className="block w-fit max-w-full p-3 rounded-inner bg-base-200 wrap-anywhere select-all">{recoveryKey}</code>
        <div className="flex flex-row flex-wrap items-baseline gap-x-4 gap-y-2">
            <Button variant="text" onClick={copy}>Kopier nøkkelen</Button>
            {isSetUp && <Button onClick={onSaved}>Jeg har lagret nøkkelen</Button>}
        </div>
        {!isSetUp && <>
            <p className="m-0">
                Oppsettet ble ikke ferdig. Nøkkelen gjelder først når oppsettet er fullført. Lagre den likevel
                nå, og fullfør under. Ikke gå ut av siden eller last den på nytt før det er gjort.
            </p>
            <Form className="w-fit!" submitText="Fullfør oppsettet" action={asAction(onSetUp)} />
        </>}
        <p role="status" className="sr-only">{isCopied && 'Nøkkelen er kopiert.'}</p>
    </>
}

type StatePropTypes = {
    recovery: Recovery,
    onSetUp: () => Promise<void>,
    onEnter: WatchedRecovery['enter'],
}

function RecoveryState({ recovery, onSetUp, onEnter }: StatePropTypes) {
    switch (recovery) {
        case 'UNAVAILABLE':
            return (
                <p className="m-0">
                    Krypteringen kom ikke i gang i denne nettleseren, så krypterte samtaler kan ikke leses her
                    nå. Prøv å laste siden på nytt, eller bruk en annen nettleser.
                </p>
            )
        case 'NOT_SET_UP':
            return <>
                <WhatAKeyIs />
                <p className="m-0">
                    Derfor bør du lage en gjenopprettingsnøkkel. Det er en lang kode som bare du har. Med den får
                    du meldingene dine tilbake hver gang du logger inn et nytt sted.
                </p>
                <Form className="w-fit!" submitText="Lag gjenopprettingsnøkkel" action={asAction(onSetUp)} />
            </>
        case 'KEY_NEEDED':
            return <>
                <WhatAKeyIs />
                <p className="m-0">
                    Du har laget en gjenopprettingsnøkkel før. Skriv den inn her, så kan du lese de eldre
                    meldingene dine i denne nettleseren også.
                </p>
                <Form className="max-w-xl" submitText="Hent meldingene mine" action={asAction(onEnter)}>
                    <TextInput name={KEY_FIELD} label="Gjenopprettingsnøkkel" autoComplete="off" spellCheck={false} />
                </Form>
                <p className="m-0 text-base-content/80">
                    Har du mistet nøkkelen? Da kan de eldre meldingene ikke leses i denne nettleseren. Det som
                    skrives fra nå av, leser du her som før, så lenge du er logget inn. Du kan ikke lage en ny
                    nøkkel her ennå.
                </p>
            </>
        case 'IDENTITY_WITHOUT_KEY':
            return <>
                <WhatAKeyIs />
                <p className="m-0">
                    Kontoen din er satt opp for kryptering et annet sted, uten gjenopprettingsnøkkel. Derfor kan
                    de eldre meldingene ikke leses i denne nettleseren, og det er ingen nøkkel å skrive inn. Det
                    som skrives fra nå av, leser du her som før, så lenge du er logget inn.
                </p>
                <p className="m-0 text-base-content/80">
                    Dette kan ikke ordnes her ennå. Det kommer sammen med oversikten over enhetene dine.
                </p>
            </>
        case 'READY':
            return <>
                <p className="m-0">
                    Du har en gjenopprettingsnøkkel, og denne nettleseren har den. Du trenger nøkkelen neste gang
                    du logger inn på chatten, her eller et annet sted, så ta godt vare på den. Mangler noen av
                    de eldre meldingene rett etter at du har skrevet inn nøkkelen, kan du laste siden på nytt
                    litt senere.
                </p>
                <WhatAKeyIs />
            </>
        default:
            return null
    }
}

/** What is asked of the recovery as the action of a form, which is given what was written in the key's field. */
function asAction<Given>(ask: (written: string) => Promise<Given>) {
    return async (formData: FormData): Promise<ActionReturn<Given>> => {
        const written = formData.get(KEY_FIELD)
        try {
            return { success: true, data: await ask(typeof written === 'string' ? written : '') }
        } catch (error) {
            if (error instanceof WrongRecoveryKey) return createActionError('BAD PARAMETERS', WRONG_KEY)
            if (error instanceof RecoveryIsSetUp) return createActionError('BAD PARAMETERS', IS_SET_UP)
            if (error instanceof RecoveryUnfinished) return createActionError('SERVER ERROR', UNFINISHED)
            return createActionError('SERVER ERROR', refusalWording[refusalOf(error)])
        }
    }
}

function WhatAKeyIs() {
    return (
        <p className="m-0 text-base-content/80">
            Direktemeldinger og grupper er kryptert. Det betyr at det som skrives, ikke lagres lesbart på
            serveren: det låses opp i nettleseren til dere som er med i samtalen, med nøkler som ligger i
            nettleseren. Logger du ut, eller åpner du chatten i en annen nettleser eller på telefonen, er de
            nøklene ikke der, og de eldre meldingene kan ikke leses.
        </p>
    )
}
