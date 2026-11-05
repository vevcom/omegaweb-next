'use client'
import { treeConnectorClassName } from './constants'
import Form from '@/components/Form/Form'
import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import { updateNotificationSubscriptionAction } from '@/services/notifications/subscription/actions'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import { configureAction } from '@/services/configureAction'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

export type SubscribableChannel = Pick<ExpandedNotificationChannel, 'id' | 'name' | 'description' | 'availableMethods'>

/**
 * The user's subscription to one channel: a method per checkbox, saved for the channel alone or
 * for the channels under it too, as far as each offers the methods.
 */
export default function UpdateNotificationSubscription({
    userId,
    channel,
    methods,
    hasChildren,
    depth = 0,
}: {
    userId: number,
    channel: SubscribableChannel,
    /** The methods subscribed with, or null when not subscribed. */
    methods: NotificationMethodGeneral | null,
    hasChildren: boolean,
    /** How far under the top of a tree the channel sits; a channel under another is marked. */
    depth?: number,
}) {
    // Text, checkboxes and buttons in one line where the row has room for all three, stacked where it has not.
    return <div className="@container py-3">
        <div className="
            flex flex-col gap-3
            @4xl:flex-row @4xl:items-center @4xl:gap-x-6
        ">
            <div className="
                min-w-0
                @4xl:flex-1
            ">
                <span className="inline-flex items-center">
                    {depth > 0 && <span className={treeConnectorClassName} aria-hidden="true" />}
                    <b>{channel.name}</b>
                </span>
                {channel.description && <span className="block mt-1 text-s text-text-muted">{channel.description}</span>}
            </div>
            {/*
              * Saving refreshes the page, since a save with the sub-channels changes other rows. The
              * checkboxes are uncontrolled, so the form is remounted when what they should show changes.
              */}
            <Form
                key={JSON.stringify(methods)}
                className="
                    flex flex-col gap-2
                    @4xl:flex-row @4xl:items-center @4xl:gap-x-4 @4xl:shrink-0 @4xl:w-auto
                "
                action={configureAction(updateNotificationSubscriptionAction, { params: { userId, channelId: channel.id } })}
                submitText="Lagre"
                refreshOnSuccess
                secondarySubmit={hasChildren ? { text: 'Med underkanaler', name: 'includeChildren' } : undefined}
            >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mr-2">
                    <NotificationMethodCheckboxes
                        label
                        methods={methods ?? allNotificationMethodsOff}
                        editable={channel.availableMethods}
                    />
                </div>
            </Form>
        </div>
    </div>
}
