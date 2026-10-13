import styles from './page.module.scss'
import LoggedInLandingPage from './LoggedIn'
import LoggedOutLandingPage from './LoggedOut'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { frontpageAuth } from '@/services/frontpage/auth'
import { Require } from '@/auth/authorizer/Require'
import { serverPage } from '@/app/serverPage'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page } = serverPage({
    operation: async ({ searchParams }: PageOperationArgs) => ({
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
                    <div className={styles.pageRoot}>
                        <Link
                            className={styles.link}
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
                    <div className={styles.pageRoot}>
                        {
                            capabilities.canEditFrontpage.authorized && (
                                <Link
                                    className={styles.link}
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
