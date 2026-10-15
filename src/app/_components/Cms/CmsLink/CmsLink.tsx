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
    /** Renders the link as a dead button - for a link whose url nobody has filled in yet. */
    disabled?: boolean
    updateCmsLinkAction: UpdateCmsLinkAction
    capabilities: Capabilities<'canEdit'>
}

const colorClassNames = {
    primary: 'btn m-0',
    secondary: 'secondary-btn m-0 hover:bg-surface-hover hover:text-text',
} as const

export default function CmsLink({
    cmsLink,
    className,
    color = 'secondary',
    disabled = false,
    updateCmsLinkAction,
    capabilities,
}: PropTypes) {
    const buttonClass = `flex justify-center items-center ${colorClassNames[color]}`

    return (
        <div
            className={[
                'relative min-w-[70px] h-[30px]',
                '[&>*]:absolute [&>*]:top-0 [&>*]:left-0 [&>*]:w-full [&>*]:h-full', className,
            ].join(' ')}
        >
            {
                disabled
                    ? <span aria-disabled className={`${buttonClass} opacity-50 cursor-default hover:bg-surface-hover`}>
                        {cmsLink.text}
                    </span>
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
