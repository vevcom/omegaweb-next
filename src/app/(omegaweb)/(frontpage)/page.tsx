import LoggedInLandingPage from './LoggedIn'
import LoggedOutLandingPage from './LoggedOut'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { frontpageAuth } from '@/services/frontpage/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import SiteLink from '@/components/SiteLink/SiteLink'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page } = serverPage({
    operation: ({ searchParams }: PageOperationArgs) => ({
        frontpageVersion: QueryParams.frontpageVersion.decode(searchParams),
    }),
    capabilities: () => ({
        canEditFrontpage: Require.anyOf(
            frontpageAuth.updateSpecialCmsParagraphContentSection,
            frontpageAuth.updateSpecialCmsImage,
        ),
    }),
    render: ({ data: { frontpageVersion }, capabilities, session }) => {
        if (!session.user) {
            return <LoggedOutLandingPage />
        }
        switch (frontpageVersion) {
            case 'logged-out':
                return (
                    <div className="relative">
                        <SiteLink
                            className="absolute top-2 right-2 z-2 btn-neutral"
                            href={appHref(`/?${QueryParams.frontpageVersion.encodeUrl('logged-in')}`)}
                        >
                            <span className="text-neutral-content">Gå til innlogget forside</span>
                        </SiteLink>
                        <LoggedOutLandingPage />
                    </div>
                )
            case 'logged-in':
            default:
                return (
                    <div className="relative">
                        {
                            capabilities.canEditFrontpage.authorized && (
                                <SiteLink
                                    className="absolute top-2 right-2 z-2 btn-neutral"
                                    href={appHref(`/?${QueryParams.frontpageVersion.encodeUrl('logged-out')}`)}
                                >
                                    <span className="text-neutral-content">Gå til utlogget forside</span>
                                </SiteLink>
                            )
                        }
                        <LoggedInLandingPage />
                    </div>
                )
        }
    },
})

export default page
