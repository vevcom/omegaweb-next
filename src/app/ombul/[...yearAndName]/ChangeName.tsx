'use client'

import styles from './ChangeName.module.scss'
import EditableTextField from '@/components/EditableTextField/EditableTextField'
import { updateOmbulAction } from '@/services/ombul/actions'
import { ombulAuth } from '@/services/ombul/auth'
import { configureAction } from '@/services/configureAction'
import useEditMode from '@/hooks/useEditMode'
import type { ReactNode } from 'react'
import type { ExpandedOmbul } from '@/services/ombul/types'

type PropTypes = {
    children: ReactNode
    ombulId: number
}

/**
 * Component that wraps the name of ombul in a EditableTextFieldthat can be submitted to update the name
 * On success the name in the url is changed to the new name
 * @param children - The text to display and edit
 * @param ombulId - The id of the ombul to update
 * @returns The component jsx
 */
export default function ChangeName({ children, ombulId }: PropTypes) {
    const editable = useEditMode({ authorizer: ombulAuth.update })
    const handleChange = (data: ExpandedOmbul | undefined) => {
        const name = data?.name
        if (!name) return
        const url = window.location.pathname
        const urlParts = url.split('/')
        urlParts[urlParts.length - 1] = name
        const newUrl = urlParts.join('/')
        window.history.pushState({ path: newUrl }, '', newUrl)
    }

    return (
        <EditableTextField
            editable={editable}
            formProps={{
                action: configureAction(
                    updateOmbulAction,
                    { params: { id: ombulId } }
                ),
                successCallback: handleChange
            }}
            inputName="name"
            submitButton={{
                text: 'Endre',
                className: styles.changeNameButton
            }}
        >
            {children}
        </EditableTextField>
    )
}
