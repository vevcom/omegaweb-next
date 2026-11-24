import ParagraphEditor from './CmsParagraphEditor'
import { htmlContentClassName } from './htmlContentClassName'
import { sanitizeHtml } from '@/lib/html/sanitizeHtml'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import React from 'react'
import type { CmsParagraph as CmsParagraphT } from '@/prisma-generated-pn-types'
import type { UpdateCmsParagraphAction } from '@/cms/paragraphs/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

export type PropTypes = {
    cmsParagraph: CmsParagraphT
    className?: string
    updateCmsParagraphAction: UpdateCmsParagraphAction
    capabilities: Capabilities<'canEdit'>
}

export default function CmsParagraph({ cmsParagraph, className, updateCmsParagraphAction, capabilities }: PropTypes) {
    return (
        <>
            <div className={`
                w-full relative
                ${className}
            `}>
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
                <ParagraphEditor
                    capabilities={capabilitiesToJsObject(capabilities)}
                    cmsParagraph={cmsParagraph}
                    updateCmsParagraphAction={updateCmsParagraphAction}
                />
            </div>
        </>
    )
}
