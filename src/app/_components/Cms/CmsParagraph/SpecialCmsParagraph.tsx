import CmsParagraph from './CmsParagraph'
import { configureAction } from '@/services/configureAction'
import React from 'react'
import type { PropTypes as PropTypesCmsParapraph } from './CmsParagraph'
import type { SpecialCmsParagraph as SpecialCmsParagraphT } from '@/prisma-generated-pn-types'
import type { ReadSpecialCmsParagraphAction } from '@/cms/paragraphs/types'

type PropTypes = Omit<PropTypesCmsParapraph, 'cmsParagraph'> & {
    special: SpecialCmsParagraphT,
    readSpecialCmsParagraphAction: ReadSpecialCmsParagraphAction
}

/**
 * WARNING: This component should only be rendered server side, on client fetch the
 * paragraph using readSpecialCmsParagraphAction
 *
 * then render it using CmsParagraph.
 * A component that reads a special type of paragraph using readSpecialCmsParagraphAction
 * then renders it using standard CmsParagraph
 * @param special - the special type of the paragraph to read
 * @param readSpecialCmsParagraphAction - the action to read the special paragraph - this should be the specific
 * implementation of the readSpecial service.
 * @returns
 */
export default async function SpecialCmsParagraph({ special, readSpecialCmsParagraphAction, ...props }: PropTypes) {
    const res = await configureAction(readSpecialCmsParagraphAction, { params: { special } })()
    if (!res.success) return <i>Error: {res.error?.[0].message}</i>

    return (
        <CmsParagraph cmsParagraph={res.data} {...props} />
    )
}
