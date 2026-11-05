import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { notificationMethodsArray, notificationMethodsDisplayMap } from '@/services/notifications/constants'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'

/** A special channel as its config has it. It is the code's, so there is nothing to edit here. */
export default function SpecialChannelInfo({ channel }: { channel: ExpandedNotificationChannel }) {
    const methods = notificationMethodsArray
        .filter(method => channel.availableMethods[method])
        .map(method => notificationMethodsDisplayMap[method])

    return (
        <PageWrapper>
            <div className="
                flex flex-col gap-2
                [&>p]:[font-weight:lighter]
            ">
                <p>Spesiell kanal: {channel.special}</p>
                <p>
                    Kanalen brukes av koden og er gitt av oppsettet. Den kan ikke endres eller sendes i herfra,
                    men dynamiske kanaler kan legges under den.
                </p>
                <p>Beskrivelse: {channel.description || '—'}</p>
                <p>Tilgjengelige metoder: {methods.length ? methods.join(', ') : 'ingen'}</p>
            </div>
        </PageWrapper>
    )
}
