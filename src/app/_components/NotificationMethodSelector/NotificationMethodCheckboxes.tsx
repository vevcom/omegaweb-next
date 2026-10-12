'use client'
import Checkbox from '@/components/UI/Checkbox'
import { notificationMethodsDisplayMap } from '@/services/notifications/constants'
import type React from 'react'
import type { NotificationMethodGeneral, NotificationMethodTypes } from '@/services/notifications/types'

export default function NotificationMethodCheckboxes({
    formPrefix,
    methods,
    label,
    editable,
    onChange,
}: {
    formPrefix?: NotificationMethodTypes,
    methods: NotificationMethodGeneral
    label?: boolean
    editable?: NotificationMethodGeneral,
    onChange?: (method: NotificationMethodGeneral) => void
}) {
    function handleChange(key: keyof NotificationMethodGeneral, event: React.ChangeEvent<HTMLInputElement>) {
        if (onChange) onChange({ ...methods, [key]: event.target.checked })
    }

    return Object.entries(methods).map(([_key, value]) => {
        const key = _key as keyof NotificationMethodGeneral

        const canEdit = !editable || editable[key]

        return <Checkbox
            key={key}
            name={formPrefix ? `${formPrefix}_${key}` : key}
            {...(onChange ? { checked: canEdit && value } : { defaultChecked: value })}
            {...(label ? { label: notificationMethodsDisplayMap[key] } : {})}
            disabled={!canEdit}
            onChange={event => handleChange(key, event)}
        />
    })
}
