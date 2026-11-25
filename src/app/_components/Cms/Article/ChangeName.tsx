'use client'
import EditableTextField from '@/components/EditableTextField/EditableTextField'
import useEditMode from '@/hooks/useEditMode'
import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ExpandedArticle, UpdateArticleAction } from '@/cms/articles/types'
import type { ConfiguredAction } from '@/services/actionTypes'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    article: ExpandedArticle
    updateArticleAction: ConfiguredAction<UpdateArticleAction>
    capabilities: CapabilitiesJsObject<'canEdit'>,
}

export default function ChangeName({ article, updateArticleAction, capabilities }: PropTypes) {
    const currentPath = usePathname()
    const [currentName, setCurrentName] = useState(article.name)
    const editable = useEditMode({ authResult: capabilities.canEdit })

    const successCallback = (data: ExpandedArticle) => {
        const oldName = encodeURIComponent(currentName)
        const newName = encodeURIComponent(data.name)
        const newPath = currentPath.replace(oldName, newName)
        setCurrentName(data.name)
        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', newPath)
        }
    }

    return (
        <EditableTextField
            formProps={
                {
                    action: updateArticleAction,
                    successCallback
                }
            }
            inputName="name"
            submitButton={{
                text: 'Lagre',
                className: 'absolute bottom-full left-0 w-[200px] [&_button]:my-2 [&_button]:mx-0'
            }}
            editable={editable}
        >
            <h1 className="text-xxl font-secondary uppercase text-white z-2 relative">{currentName}</h1>
        </EditableTextField>
    )
}
