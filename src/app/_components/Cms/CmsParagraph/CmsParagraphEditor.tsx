'use client'
import useEditMode from '@/hooks/useEditMode'
import type { ReactNode } from 'react'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    /** What takes the place of the paragraph in edit mode. */
    editor: ReactNode
    capabilities: CapabilitiesJsObject<'canEdit'>
    /** The paragraph as it is read. */
    children: ReactNode
}

export default function CmsParagraphEditor({ editor, capabilities, children }: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })

    return editable ? editor : children
}
