import styles from './CmsLink.module.scss'
import CmsLinkEditor from './CmsLinkEditor'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import Link from 'next/link'
import type { CmsLink as CmsLinkT } from '@/prisma-generated-pn-types'
import type { UpdateCmsLinkAction } from '@/cms/links/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    cmsLink: CmsLinkT
    className?: string
    color?: 'primary' | 'secondary'
    updateCmsLinkAction: UpdateCmsLinkAction
    capabilities: Capabilities<'canEdit'>
}

export default function CmsLink({ cmsLink, className, color = 'secondary', updateCmsLinkAction, capabilities }: PropTypes) {
    return (
        <div className={`${styles.CmsLink} ${className}`}>
            <Link href={cmsLink.url} className={`${styles.CmsLink} ${styles[color]}`}>{cmsLink.text}</Link>
            <CmsLinkEditor
                capabilities={capabilitiesToJsObject(capabilities)}
                cmsLink={cmsLink}
                updateCmsLinkAction={updateCmsLinkAction}
            />
        </div>
    )
}
