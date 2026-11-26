'use client'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import SiteLink from '@/components/SiteLink/SiteLink'
import { watchRecovery } from '@/lib/chatSession/recovery'
import { useMemo, useSyncExternalStore } from 'react'
import type { MatrixClient } from 'matrix-js-sdk'

/**
 * Says, where encrypted messages are read, that earlier ones cannot be read in this browser yet
 * and how to get them, or that they will be lost at a logout, and leads to where it is put right.
 * Nothing for one whose recovery key is in place.
 */
export default function ChatRecoveryNotice({ client }: { client: MatrixClient }) {
    const watched = useMemo(() => watchRecovery(client), [client])
    const recovery = useSyncExternalStore(watched.subscribe, watched.read)

    if (recovery === 'KEY_NEEDED') {
        return (
            <p className="m-0 text-s">
                Krypterte meldinger fra før du logget inn her, kan ikke leses i denne nettleseren ennå. {}
                <SiteLink href={chatLinks.settings()}>Skriv inn gjenopprettingsnøkkelen din</SiteLink> for å lese dem.
            </p>
        )
    }
    if (recovery === 'IDENTITY_WITHOUT_KEY') {
        return (
            <p className="m-0 text-s">
                Krypterte meldinger fra før du logget inn her, kan ikke leses i denne nettleseren. {}
                <SiteLink href={chatLinks.settings()}>Les hvorfor</SiteLink>.
            </p>
        )
    }
    if (recovery === 'NOT_SET_UP') {
        return (
            <p className="m-0 text-s">
                Logger du ut, kan du ikke lenger lese de krypterte meldingene dine. {}
                <SiteLink href={chatLinks.settings()}>Lag en gjenopprettingsnøkkel</SiteLink> for å beholde dem.
            </p>
        )
    }
    return null
}
