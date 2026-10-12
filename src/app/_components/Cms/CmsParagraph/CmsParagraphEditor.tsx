'use client'
import styles from './CmsParagraphEditor.module.scss'
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
            showButtonClass={styles.openBtn}
            showButtonContent={
                <EditOverlay />
            }>
            <CmsParagraphEditorForm
                className={`${styles.CmsParagraphEditor} ${editorClassName ?? ''}`}
                cmsParagraph={cmsParagraph}
                updateCmsParagraphAction={updateCmsParagraphAction}
            />
        </PopUp>
    )
}
