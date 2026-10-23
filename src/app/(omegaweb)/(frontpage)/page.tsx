import LoggedInLandingPage from './LoggedIn'
import LoggedOutLandingPage from './LoggedOut'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { frontpageAuth } from '@/services/frontpage/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/ServerPage'
import Link from 'next/link'
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
                        <Link
                            className="absolute top-2 right-2 z-2 secondary-btn"
                            href={`/?${QueryParams.frontpageVersion.encodeUrl('logged-in')}`}
                        >
                            <span>Gå til innlogget forside</span>
                        </Link>
                        <LoggedOutLandingPage />
                    </div>
                )
            case 'logged-in':
            default:
                return (
                    <div className="relative">
                        {
                            capabilities.canEditFrontpage.authorized && (
                                <Link
                                    className="absolute top-2 right-2 z-2 secondary-btn"
                                    href={`/?${QueryParams.frontpageVersion.encodeUrl('logged-out')}`}
                                >
                                    <span>Gå til utlogget forside</span>
                                </Link>
                            )
                        }
                        <LoggedInLandingPage />
                    </div>
                )
        }
    },
})

export default page
