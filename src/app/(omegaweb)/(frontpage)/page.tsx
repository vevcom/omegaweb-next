import LoggedInLandingPage from './LoggedIn'
import LoggedOutLandingPage from './LoggedOut'
import ButtonLink from '@/components/UI/ButtonLink'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { frontpageAuth } from '@/services/frontpage/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import { appHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page } = serverPage({
    operation: ({ searchParams }: PageOperationArgs) => ({
        frontpageVersion: QueryParams.frontpageVersion.decode(searchParams),
    }),
    capabilities: () => ({
        canEditFrontpage: Require.anyOf(
            frontpageAuth.cmsParagraphs.updateContent,
            frontpageAuth.cmsImages.update,
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
                        <ButtonLink color="neutral" className="absolute top-2 right-2 z-2"
                            href={appHref(`/?${QueryParams.frontpageVersion.encodeUrl('logged-in')}`)}
                        >
                            <span className="text-neutral-content">Gå til innlogget forside</span>
                        </ButtonLink>
                        <LoggedOutLandingPage />
                    </div>
                )
            case 'logged-in':
            default:
                return (
                    <div className="relative">
                        {
                            capabilities.canEditFrontpage.authorized && (
                                <ButtonLink color="neutral" className="absolute top-2 right-2 z-2"
                                    href={appHref(`/?${QueryParams.frontpageVersion.encodeUrl('logged-out')}`)}
                                >
                                    <span className="text-neutral-content">Gå til utlogget forside</span>
                                </ButtonLink>
                            )
                        }
                        <LoggedInLandingPage />
                    </div>
                )
        }
    },
})

export default page
