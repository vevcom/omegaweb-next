

import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import React from 'react'
import type { NotificationMethodGeneral } from '@/services/notifications/types'
import type { NotificationBranch } from './types'


export default function SubscriptionItem({
    branch,
    depth,
    onChange,
}: {
    branch: NotificationBranch,
    depth?: number,
    onChange?: (branchId: number, method: NotificationMethodGeneral) => void
}) {
    const checkboxes = NotificationMethodCheckboxes({
        methods: branch.subscription?.methods ?? allNotificationMethodsOff,
        editable: branch.availableMethods,
        onChange: (method: NotificationMethodGeneral) => {
            if (!onChange) {
                return
            }

            onChange(branch.id, method)
        }
    })

    return <>
        <tr>
            <td
                className="pl-[calc((1.5+1.5*var(--depth))*var(--gap))]!"
                style={{
                    '--depth': depth ?? 0,
                } as React.CSSProperties}
            >
                <span className="inline-flex items-center">
                    {depth ? <span
                        className="inline-block size-[0.6em] mr-[0.6em] shrink-0 border-l-2 border-b-2 border-text-muted"
                        aria-hidden="true"
                    /> : null}
                    <b>{branch.name}</b>
                </span>
                {branch.description && (
                    <span className="block mt-[0.2em] text-text-muted text-s">{branch.description}</span>
                )}
            </td>

            {checkboxes.map(checkbox => <td
                key={checkbox.key}
                className="[&>div]:flex [&>div]:justify-center [&>div]:items-center"
            >
                <div>{checkbox}</div>
            </td>
            )}
        </tr>

        {branch.children.map(b => <SubscriptionItem
            key={b.id}
            branch={b}
            depth={(depth ?? 0) + 1}
            onChange={onChange}
        />)}
    </>
}
