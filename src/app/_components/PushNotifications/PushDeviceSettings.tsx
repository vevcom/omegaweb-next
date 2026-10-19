'use client'

import styles from './PushDeviceSettings.module.scss'
import {
    readBrowserPushSubscription,
    readPushSupport,
    removeBrowserPushSubscription,
    saveBrowserPushSubscription,
    subscribeBrowser,
    usesServerKey,
} from './browserPushSubscription'
import Button from '@/components/UI/Button'
import { useEffect, useState } from 'react'

type Status = 'loading' | 'unsupported' | 'needsHomeScreen' | 'notConfigured' | 'blocked' | 'off' | 'on'

async function readStatus(userId: number, vapidPublicKey: string | null): Promise<Status> {
    const support = readPushSupport()
    if (support !== 'supported') return support
    if (!vapidPublicKey) return 'notConfigured'
    if (Notification.permission === 'denied') return 'blocked'

    const subscription = await readBrowserPushSubscription()
    if (!subscription) return 'off'
    if (!usesServerKey(subscription, vapidPublicKey)) {
        await subscription.unsubscribe()
        return 'off'
    }

    const saved = await saveBrowserPushSubscription(userId, subscription)
    return saved.success ? 'on' : 'off'
}

/**
 * Turns push notifications on or off for the browser it is shown in. A browser already subscribed
 * is saved again for this user, since whoever signed in on it last may have been someone else.
 */
export default function PushDeviceSettings({ userId, vapidPublicKey }: {
    userId: number,
    vapidPublicKey: string | null,
}) {
    const [status, setStatus] = useState<Status>('loading')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        readStatus(userId, vapidPublicKey).then(setStatus).catch(() => setStatus('unsupported'))
    }, [userId, vapidPublicKey])

    async function enable() {
        if (!vapidPublicKey) return
        setPending(true)
        setError(null)
        try {
            const permission = await Notification.requestPermission()
            if (permission === 'denied') {
                setStatus('blocked')
                return
            }
            if (permission !== 'granted') return

            const result = await subscribeBrowser(userId, vapidPublicKey)
            if (result.success) {
                setStatus('on')
            } else {
                setError(result.error?.[0]?.message ?? 'Kunne ikke skru på push-varsler.')
            }
        } catch {
            setError('Nettleseren kunne ikke skru på push-varsler. Prøv igjen.')
        } finally {
            setPending(false)
        }
    }

    async function disable() {
        setPending(true)
        setError(null)
        try {
            await removeBrowserPushSubscription()
            setStatus('off')
        } catch {
            setError('Kunne ikke skru av push-varsler. Prøv igjen.')
        } finally {
            setPending(false)
        }
    }

    return <section className={styles.pushDevice}>
        <h3>Push-varsler på denne enheten</h3>

        {status === 'unsupported' && <p>
            Denne nettleseren støtter ikke push-varsler. Bruk en nyere versjon av Chrome, Firefox, Edge eller
            Safari for å få dem.
        </p>}

        {status === 'needsHomeScreen' && <>
            <p>På iPhone og iPad får du bare push-varsler når Omega er lagt til på Hjem-skjermen:</p>
            <ol>
                <li>Åpne denne siden i Safari.</li>
                <li>Trykk på Del-knappen og velg «Legg til på Hjem-skjerm».</li>
                <li>Åpne Omega fra ikonet på Hjem-skjermen, logg inn og kom tilbake hit.</li>
            </ol>
        </>}

        {status === 'notConfigured' && <p>Push-varsler er ikke satt opp på denne serveren ennå.</p>}

        {status === 'blocked' && <p>
            Du har blokkert varsler fra denne siden. Tillat varsler i nettleserens innstillinger for nettstedet,
            som du ofte finner ved hengelåsen i adressefeltet, og last siden på nytt. På iPhone og iPad finner
            du det under Innstillinger, Varslinger og Omega.
        </p>}

        {status === 'off' && <>
            <p>
                Skru på push-varsler for å få varslene rett på denne enheten, også når siden er lukket. Det
                skrus på for én enhet om gangen, så gjør det på hver mobil og datamaskin du vil ha dem på.
            </p>
            <Button onClick={enable} disabled={pending}>Skru på push-varsler</Button>
        </>}

        {status === 'on' && <>
            <p>
                Push-varsler er på for denne enheten. Du får dem fra kanalene som har Push-varsel huket av i
                tabellen under. Logger du ut, skrus de av på denne enheten.
            </p>
            <Button color="secondary" onClick={disable} disabled={pending}>Skru av på denne enheten</Button>
        </>}

        {error && <p className={styles.error}>{error}</p>}
    </section>
}
