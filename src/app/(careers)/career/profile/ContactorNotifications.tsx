'use client'
import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import { updateNotificationSubscriptionsAction } from '@/services/notifications/subscription/actions'
import { useState } from 'react'
import type { NotificationMethodGeneral } from '@/services/notifications/types'

type PropTypes = {
    userId: number
    channelId: number
    availableMethods: NotificationMethodGeneral
    methods: NotificationMethodGeneral
}

/** The user's subscription to the Contactor channel, saved as soon as a method is ticked. */
export default function ContactorNotifications({ userId, channelId, availableMethods, methods }: PropTypes) {
    const [current, setCurrent] = useState(methods)
    const [error, setError] = useState<string | null>(null)

    const save = async (next: NotificationMethodGeneral) => {
        const previous = current
        setCurrent(next)
        setError(null)
        const result = await updateNotificationSubscriptionsAction(
            { params: { userId } },
            { data: { subscriptions: [{ channelId, methods: next }] } },
        )
        if (!result.success) {
            setCurrent(previous)
            setError(result.error?.[0]?.message ?? 'Kunne ikke lagre varslingene')
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-x-8 gap-y-2">
                <NotificationMethodCheckboxes
                    methods={current}
                    editable={availableMethods}
                    label
                    onChange={save}
                />
            </div>
            {error && <p className="text-s text-accent-red">{error}</p>}
        </div>
    )
}
