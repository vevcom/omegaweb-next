import ParagraphEditor from './CmsParagraphEditor'
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
                w-full relative mb-4
                ${className}
            `}>
                {cmsParagraph.contentHtml ? (
                    <div
                        className="
                            w-full
                            [&_*]:break-words [&_*]:text-text-muted
                            [&_ul]:pl-[1.5em]
                            [&_ol]:pl-[1.5em]
                            [&_a]:no-underline [&_a]:text-accent-blue [&_a]:font-bold
                            [&_a:hover]:underline
                            [&_h1]:mb-[.5em]
                            [&_h2]:mb-[.5em]
                            [&_h1]:text-text
                            [&_h2]:text-text
                            [&_p]:leading-[1.5]
                        "
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
