'use client'

import styles from './NotificationMethodSelector.module.scss'
import NotificationMethodCheckboxes from './NotificationMethodCheckboxes'
import React from 'react'
import type { NotificationMethodTypes, NotificationMethodGeneral } from '@/services/notifications/types'

export default function NotificationMethodSelector({
    title,
    formPrefix,
    methods,
    editable,
    onChange,
}: {
    title?: string,
    formPrefix?: NotificationMethodTypes,
    methods: NotificationMethodGeneral
    editable?: NotificationMethodGeneral,
    onChange?: (method: NotificationMethodGeneral) => void
}) {
    const checkboxes = NotificationMethodCheckboxes({
        formPrefix,
        label: true,
        methods,
        editable,
        onChange,
    })

    return <div className={styles.channelMethods}>
        {title ?
            <h4>{title}</h4> : null
        }

        {...checkboxes}
    </div>
}
