'use client'
import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import { updateNotificationSubscriptionsAction } from '@/services/notifications/subscription/actions'
import { useRef, useState } from 'react'
import type { NotificationMethodGeneral } from '@/services/notifications/types'

type PropTypes = {
    userId: number
    channelId: number
    availableMethods: NotificationMethodGeneral
    methods: NotificationMethodGeneral
}

/**
 * The user's subscription to the Contactor channel, saved as soon as a method is ticked. One save
 * runs at a time: ticks made while one is on its way are sent together once it is done, so an
 * earlier save never lands after a later one.
 */
export default function ContactorNotifications({ userId, channelId, availableMethods, methods }: PropTypes) {
    const [current, setCurrent] = useState(methods)
    const [error, setError] = useState<string | null>(null)
    const saved = useRef(methods)
    const wanted = useRef(methods)
    const saving = useRef<Promise<void> | null>(null)

    const sendWanted = async (): Promise<void> => {
        const next = wanted.current
        const result = await updateNotificationSubscriptionsAction(
            { params: { userId } },
            { data: { subscriptions: [{ channelId, methods: next }] } },
        )
        if (!result.success) {
            wanted.current = saved.current
            setCurrent(saved.current)
            setError(result.error?.[0]?.message ?? 'Kunne ikke lagre varslingene')
            return
        }
        saved.current = next
        if (wanted.current !== next) await sendWanted()
    }

    const save = (next: NotificationMethodGeneral) => {
        wanted.current = next
        setCurrent(next)
        setError(null)
        saving.current ??= sendWanted().finally(() => {
            saving.current = null
        })
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
            {error && <p className="text-s text-error">{error}</p>}
        </div>
    )
}
