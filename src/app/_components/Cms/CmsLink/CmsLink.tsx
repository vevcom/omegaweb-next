import CmsLinkEditor from './CmsLinkEditor'
import { capabilitiesToJsObject } from '@/auth/authorizer/capabilities'
import SiteLink from '@/components/SiteLink/SiteLink'
import { hrefOf } from '@/lib/sites/href'
import type { CmsLink as CmsLinkT } from '@/prisma-generated-pn-types'
import type { UpdateCmsLinkAction } from '@/cms/links/types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

export type PropTypes = {
    cmsLink: CmsLinkT
    className?: string
    color?: 'primary' | 'secondary' | 'neutral'
    /** Renders the link as a dead button - for a link whose url nobody has filled in yet. */
    disabled?: boolean
    updateCmsLinkAction: UpdateCmsLinkAction
    capabilities: Capabilities<'canEdit'>
}

const colorClassNames = {
    primary: 'btn-primary m-0',
    secondary: `
        btn-neutral m-0
        hover:bg-neutral-hover hover:text-neutral-content`,
    neutral:
        `btn-neutral m-0
        hover:bg-neutral-hover hover:text-neutral-content`,
} as const

export default function CmsLink({
    cmsLink,
    className,
    color = 'secondary',
    disabled = false,
    updateCmsLinkAction,
    capabilities,
}: PropTypes) {
    const buttonClass = `
        flex justify-center items-center
        ${colorClassNames[color]}
    `

    return (
        <div
            className={`
                relative min-w-[70px] h-[30px]
                [&>*]:absolute [&>*]:top-0 [&>*]:left-0 [&>*]:w-full [&>*]:h-full
                ${className}
            `}
        >
            {
                disabled
                    ? <span aria-disabled className={`
                        ${buttonClass}
                        opacity-50 cursor-default
                        hover:bg-neutral-hover
                    `}>
                        {cmsLink.text}
                    </span>
                    : <SiteLink href={hrefOf(cmsLink.url)} className={buttonClass}>{cmsLink.text}</SiteLink>
            }
            <CmsLinkEditor
                capabilities={capabilitiesToJsObject(capabilities)}
                cmsLink={cmsLink}
                updateCmsLinkAction={updateCmsLinkAction}
            />
        </div>
    )
}
