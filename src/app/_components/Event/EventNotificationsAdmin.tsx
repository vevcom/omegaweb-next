'use client'
import Form from '@/components/Form/Form'
import CreateNotificationForm from '@/components/Notifications/CreateNotificationForm'
import { createEventNotificationAction, createEventPaymentReminderAction } from '@/services/events/notifications/actions'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { AppHref } from '@/lib/sites/href'

const sectionClassName = `
    flex flex-col gap-3 p-4 bg-surface-subtle rounded-inner
    [&>h3]:m-0 [&>h3]:text-l
    [&>p]:m-0 [&>p]:text-s [&>p]:text-text-muted
`

/** What the organisers send to those the event concerns: a reminder to pay, and whatever else they have to say. */
export default function EventNotificationsAdmin({
    event,
    eventHref,
}: {
    event: { id: number, takesPayment: boolean, generalNotificationChannelId: number },
    /** The event's page, which the notification links to unless another is given. */
    eventHref: AppHref,
}) {
    const [reminderMessage, setReminderMessage] = useState<string | null>(null)

    return <div className="
        flex flex-col gap-4 min-w-[min(80vw,40rem)]
        [&>h2]:m-0
    ">
        <h2>Varsle</h2>

        {event.takesPayment && <section className={sectionClassName}>
            <h3>Betalingspåminnelse</h3>
            <p>
                Minner dem som har plass, men ikke har betalt, på å betale. Varselet går i kanalen for viktig
                informasjon om arrangementet.
            </p>
            <Form
                action={configureAction(createEventPaymentReminderAction, { params: { eventId: event.id } })}
                submitText="Send betalingspåminnelse"
                confirmation={{ confirm: true, text: 'Vil du minne alle som ikke har betalt på å betale?' }}
                successCallback={() => setReminderMessage('Påminnelsen er lagt i køen.')}
            />
            {reminderMessage && <p>{reminderMessage}</p>}
        </section>}

        <section className={sectionClassName}>
            <h3>Nytt varsel</h3>
            <p>Går i arrangementets egen kanal, til dem som abonnerer på varslinger om arrangementer.</p>
            <CreateNotificationForm
                action={configureAction(
                    configureAction(createEventNotificationAction, { implementationParams: { eventId: event.id } }),
                    { params: { channelId: event.generalNotificationChannelId } },
                )}
                audienceOptions={[
                    { label: 'Alle som kan melde seg på', audience: { canRegisterForEventId: event.id } },
                    { label: 'De som er meldt på', audience: { registeredForEventId: event.id } },
                ]}
                defaultUrl={eventHref}
            />
        </section>
    </div>
}
