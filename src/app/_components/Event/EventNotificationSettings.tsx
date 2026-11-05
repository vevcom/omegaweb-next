'use client'
import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import SubmitButton from '@/components/UI/SubmitButton'
import { updateNotificationSubscriptionsAction } from '@/services/notifications/subscription/actions'
import { notificationSubscriptionAuth } from '@/services/notifications/subscription/auth'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import useAuthorizer from '@/hooks/useAuthorizer'
import { useState } from 'react'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'
import type { MinimizedSubscription } from '@/services/notifications/subscription/types'

type ChannelOfEvent = Pick<ExpandedNotificationChannel, 'id' | 'description' | 'availableMethods'> & { label: string }

/**
 * The viewer's subscriptions to the channels of the event: the info channel, which registering signs
 * them up to, and the general one.
 */
export default function EventNotificationSettings({
    userId,
    channels,
    subscriptions,
}: {
    userId: number,
    channels: ChannelOfEvent[],
    subscriptions: MinimizedSubscription[],
}) {
    const [methods, setMethods] = useState<Record<number, NotificationMethodGeneral>>(Object.fromEntries(
        channels.map(channel => [
            channel.id,
            subscriptions.find(subscription => subscription.channelId === channel.id)?.methods ?? allNotificationMethodsOff,
        ])
    ))
    const [state, setState] = useState<{ pending: boolean, success: boolean, error: string | null }>({
        pending: false,
        success: false,
        error: null,
    })
    const canUpdate = useAuthorizer({ authorizer: notificationSubscriptionAuth.update.data({ userId }) }).authorized

    if (!canUpdate) return null

    const save = async () => {
        setState({ pending: true, success: false, error: null })
        const result = await updateNotificationSubscriptionsAction({ params: { userId } }, {
            data: {
                subscriptions: channels.map(channel => ({ channelId: channel.id, methods: methods[channel.id] })),
            },
        })
        setState({
            pending: false,
            success: result.success,
            error: result.success ? null : (result.error?.[0]?.message ?? 'Kunne ikke lagre.'),
        })
    }

    return <div className="flex flex-col gap-3">
        {channels.map(channel => (
            <div key={channel.id} className="flex flex-col gap-1">
                <b>{channel.label}</b>
                <span className="text-s text-text-muted">{channel.description}</span>
                <div className="flex flex-wrap gap-x-4">
                    <NotificationMethodCheckboxes
                        label
                        methods={methods[channel.id]}
                        editable={channel.availableMethods}
                        onChange={changed => setMethods(current => ({ ...current, [channel.id]: changed }))}
                    />
                </div>
            </div>
        ))}
        <SubmitButton
            color="primary"
            className="w-full! m-0!"
            onClick={save}
            pending={state.pending}
            success={state.success}
        >
            Lagre varslinger
        </SubmitButton>
        {state.error && <p className="m-0 text-accent-red">{state.error}</p>}
    </div>
}
