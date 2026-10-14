import CmsLink from './CmsLink'
import { configureAction } from '@/services/configureAction'
import type { PropTypes as CmsLinkProps } from './CmsLink'
import type { SpecialCmsLink as SpecialCmsLinkT } from '@/prisma-generated-pn-types'
import type { ReadSpecialCmsLinkAction } from '@/cms/links/types'

type PropTypes = Omit<CmsLinkProps, 'cmsLink'> & {
    special: SpecialCmsLinkT,
    readSpecialCmsLinkAction: ReadSpecialCmsLinkAction,
}

/**
 * WARNING: This component is only meant for the server.
 * Reads a special cms link with readSpecialCmsLinkAction - the owning service's implementation of
 * the readSpecial sub-operation - then renders it with the standard CmsLink.
 * @param special - the special link to read
 * @param readSpecialCmsLinkAction - the action to read it with
 */
export default async function SpecialCmsLink({ special, readSpecialCmsLinkAction, ...props }: PropTypes) {
    const res = await configureAction(readSpecialCmsLinkAction, { params: { special } })()
    if (!res.success) return <i>Error: {res.error && res.error[0].message}</i>

    return (
        <CmsLink cmsLink={res.data} {...props} />
    )
}
