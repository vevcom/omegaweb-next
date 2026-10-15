'use client'

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

    return <div className="flex flex-col m-[1rem]">
        {title ?
            <h4>{title}</h4> : null
        }

        {...checkboxes}
    </div>
}
