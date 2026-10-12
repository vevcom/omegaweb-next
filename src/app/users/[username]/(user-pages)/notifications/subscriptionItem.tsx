

import styles from './subscriptionItem.module.scss'
import NotificationMethodCheckboxes from '@/components/NotificationMethodSelector/NotificationMethodCheckboxes'
import { allNotificationMethodsOn } from '@/services/notifications/constants'
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
        methods: branch.subscription?.methods ?? allNotificationMethodsOn,
        editable: branch.availableMethods,
        onChange: (method: NotificationMethodGeneral) => {
            if (!onChange) {
                return
            }

            onChange(branch.id, method)
        }
    })

    return <>
        <tr className={styles.subscriptionItem}>
            <td
                className={styles.channelName}
                style={{
                    '--depth': depth ?? 0,
                } as React.CSSProperties}
            >
                <span className={styles.name}>
                    {depth ? <span className={styles.branch} aria-hidden="true" /> : null}
                    <b>{branch.name}</b>
                </span>
                {branch.description && <span className={styles.description}>{branch.description}</span>}
            </td>

            {checkboxes.map(checkbox => <td
                key={checkbox.key}
                className={styles.checkbox}
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
