import ParagraphEditor from './CmsParagraphEditor'
import CmsParagraphEditorForm from './CmsParagraphEditorForm'
import { htmlContentClassName } from './htmlContentClassName'
import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import React from 'react'
import type { ReactNode } from 'react'
import type { CmsParagraph as CmsParagraphT } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

/**
 * In edit mode the paragraph is edited by `editor`, which an owner in the contract form binds with
 * `implementParagraphEditor`, or by the editor of before, given the owner's `updateCmsParagraphAction`.
 */
export type PropTypes = {
    cmsParagraph: CmsParagraphT
    className?: string
    capabilities: Capabilities<'canEdit'>
} & (
    | { updateCmsParagraphAction: UpdateCmsParagraphAction, editor?: undefined }
    | { editor: ReactNode, updateCmsParagraphAction?: undefined }
)

export default function CmsParagraph({ cmsParagraph, className, capabilities, ...editing }: PropTypes) {
    return (
        <>
            <div className={`
                w-full relative
                ${className}
            `}>
                <ParagraphEditor
                    capabilities={capabilitiesToJsObject(capabilities)}
                    editor={editing.updateCmsParagraphAction ? (
                        <CmsParagraphEditorForm
                            cmsParagraph={cmsParagraph}
                            updateCmsParagraphAction={editing.updateCmsParagraphAction}
                        />
                    ) : editing.editor}
                >
                    {cmsParagraph.contentHtml ? (
                        <div
                            className={htmlContentClassName}
                            // Sanitized again on the way out, not only when written: older rows, and the
                            // html imported from OmegaWeb Basic, never passed through it.
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(cmsParagraph.contentHtml) }}
                        />
                    ) : (
                        <i>Her var det ikke noe innhold</i>
                    )}
                </ParagraphEditor>
            </div>
        </>
    )
}
