'use client'
import Form from '@/components/Form/Form'
import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import { updateNotificationSubscriptionAction } from '@/services/notifications/subscription/actions'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import { configureAction } from '@/services/configureAction'
import type { CSSProperties } from 'react'
import type { ExpandedNotificationChannel, NotificationMethodGeneral } from '@/services/notifications/types'

export type SubscribableChannel = Pick<ExpandedNotificationChannel, 'id' | 'name' | 'description' | 'availableMethods'>

export const treeConnectorClassName = `
    inline-block size-[0.6em] mr-[0.6em] shrink-0 border-l-2 border-b-2 border-text-muted
`

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
    /** How far under the top of a tree the channel sits, for the indent. */
    depth?: number,
}) {
    return <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 pl-[calc(var(--depth)*1.5rem)]"
        style={{ '--depth': depth } as CSSProperties}
    >
        <div className="flex-[1_1_14rem] min-w-0">
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
            className="flex-[1_1_20rem] flex flex-wrap items-center gap-x-4 gap-y-2"
            action={configureAction(updateNotificationSubscriptionAction, { params: { userId, channelId: channel.id } })}
            submitText="Lagre"
            refreshOnSuccess
            secondarySubmit={hasChildren ? { text: 'Med underkanaler', name: 'includeChildren' } : undefined}
        >
            <NotificationMethodCheckboxes
                label
                methods={methods ?? allNotificationMethodsOff}
                editable={channel.availableMethods}
            />
        </Form>
    </div>
}
