import CmsParagraph from './CmsParagraph'
import { readSpecialCmsPart } from '@/cms/readSpecialCmsPart'
import type { PropTypes as PropTypesCmsParapraph } from './CmsParagraph'
import type { SpecialCmsParagraph as SpecialCmsParagraphT } from '@/prisma-generated-pn-types'
import type { ReadSpecialCmsParagraph, UpdateCmsParagraphAction } from '@/cms/paragraphs/types'

type PropTypes = Pick<PropTypesCmsParapraph, 'className' | 'capabilities'> & {
    updateCmsParagraphAction: UpdateCmsParagraphAction,
    special: SpecialCmsParagraphT,
    readSpecialCmsParagraph: ReadSpecialCmsParagraph
}

/**
 * Reads a special paragraph and renders it with the standard CmsParagraph. A server component.
 * @param special - the special paragraph to read
 * @param readSpecialCmsParagraph - the read operation of the service that owns the paragraph
 */
export default async function SpecialCmsParagraph({ special, readSpecialCmsParagraph, ...props }: PropTypes) {
    const res = await readSpecialCmsPart(() => readSpecialCmsParagraph({ params: { special } }))
    if (!res.success) return <i>Feil: {res.message}</i>

    return (
        <CmsParagraph cmsParagraph={res.part} {...props} />
    )
}
