'use client'
import CmsParagraphEditorForm from './CmsParagraphEditorForm'
import EditOverlay from '@/components/Cms/EditOverlay'
import PopUp from '@/components/PopUp/PopUp'
import useEditMode from '@/hooks/useEditMode'
import type { CmsParagraph } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

type PropTypes = {
    cmsParagraph: CmsParagraph
    editorClassName?: string
    updateCmsParagraphAction: UpdateCmsParagraphAction
    capabilities: CapabilitiesJsObject<'canEdit'>
}

export default function CmsParagraphEditor({
    cmsParagraph,
    editorClassName,
    updateCmsParagraphAction,
    capabilities,
}: PropTypes) {
    const editable = useEditMode({ authResult: capabilities.canEdit })

    if (!editable) return null
    return (
        <PopUp
            popUpKey={`EditCmsParagraph${cmsParagraph.id}`}
            showButtonClass="border-none bg-transparent overflow-hidden [&>*]:rounded-round"
            showButtonContent={
                <EditOverlay />
            }>
            <CmsParagraphEditorForm
                // In the pop-up the editor (or its loader, whichever is the first child) takes up most of the screen.
                className={`w-[70vw] [&>:first-child]:h-[70vh] ${editorClassName ?? ''}`}
                cmsParagraph={cmsParagraph}
                updateCmsParagraphAction={updateCmsParagraphAction}
            />
        </PopUp>
    )
}
