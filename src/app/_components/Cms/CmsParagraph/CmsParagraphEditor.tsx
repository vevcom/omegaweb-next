'use client'
import CmsParagraphEditorForm from './CmsParagraphEditorForm'
import useEditMode from '@/hooks/useEditMode'
import type { ReactNode } from 'react'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    cmsParagraph: CmsParagraph
    editorClassName?: string
    updateCmsParagraphAction: UpdateCmsParagraphAction
    capabilities: CapabilitiesJsObject<'canEdit'>
    /** The paragraph as it is read, which the editor takes the place of in edit mode. */
    children: ReactNode
}

export default function CmsParagraphEditor({
    cmsParagraph,
    editorClassName,
    updateCmsParagraphAction,
    capabilities,
    children,
}: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })

    if (!editable) return children
    return <CmsParagraphEditorForm
        className={editorClassName}
        cmsParagraph={cmsParagraph}
        updateCmsParagraphAction={updateCmsParagraphAction}
    />
}
