import styles from './CmsLink.module.scss'
import CmsLinkEditor from './CmsLinkEditor'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import Link from 'next/link'
import type { CmsLink as CmsLinkT } from '@/prisma-generated-pn-types'
import type { UpdateCmsLinkAction } from '@/cms/links/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

export type PropTypes = {
    cmsLink: CmsLinkT
    className?: string
    color?: 'primary' | 'secondary'
    /** Renders the link as a dead button - for a link whose url nobody has filled in yet. */
    disabled?: boolean
    updateCmsLinkAction: UpdateCmsLinkAction
    capabilities: Capabilities<'canEdit'>
}

export default function CmsLink({
    cmsLink,
    className,
    color = 'secondary',
    disabled = false,
    updateCmsLinkAction,
    capabilities,
}: PropTypes) {
    const buttonClass = `${styles.CmsLink} ${styles[color]}`

    return (
        <div className={`${styles.CmsLink} ${className}`}>
            {
                disabled
                    ? <span aria-disabled className={`${buttonClass} ${styles.disabled}`}>{cmsLink.text}</span>
                    : <Link href={cmsLink.url} className={buttonClass}>{cmsLink.text}</Link>
            }
            <CmsLinkEditor
                capabilities={capabilitiesToJsObject(capabilities)}
                cmsLink={cmsLink}
                updateCmsLinkAction={updateCmsLinkAction}
            />
        </div>
    )
}
