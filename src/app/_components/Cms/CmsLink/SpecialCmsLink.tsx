import CmsLink from './CmsLink'
import { readSpecialCmsPart } from '@/cms/readSpecialCmsPart'
import type { PropTypes as CmsLinkProps } from './CmsLink'
import type { SpecialCmsLink as SpecialCmsLinkT } from '@/prisma-generated-pn-types'
import type { ReadSpecialCmsLink } from '@/cms/links/types'

type PropTypes = Omit<CmsLinkProps, 'cmsLink'> & {
    special: SpecialCmsLinkT,
    readSpecialCmsLink: ReadSpecialCmsLink,
}

/**
 * Reads a special link and renders it with the standard CmsLink. A server component.
 * @param special - the special link to read
 * @param readSpecialCmsLink - the read operation of the service that owns the link
 */
export default async function SpecialCmsLink({ special, readSpecialCmsLink, ...props }: PropTypes) {
    const res = await readSpecialCmsPart(() => readSpecialCmsLink({ params: { special } }))
    if (!res.success) return <i>Error: {res.message}</i>

    return (
        <CmsLink cmsLink={res.part} {...props} />
    )
}
