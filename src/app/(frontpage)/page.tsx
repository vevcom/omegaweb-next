import styles from './page.module.scss'
import LoggedInLandingPage from './LoggedIn'
import LoggedOutLandingPage from './LoggedOut'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { ServerSession } from '@/auth/session/ServerSession'
import { frontpageAuth } from '@/services/frontpage/auth'
import { Require } from '@/auth/authorizer/Require'
import { runCapabilities } from '@/auth/authorizer/capabilities'
import Link from 'next/link'
import type { SearchParamsServerSide } from '@/lib/queryParams/types'

type PropTypes = SearchParamsServerSide

export default async function Home({ searchParams }: PropTypes) {
    const session = await ServerSession.fromNextAuth()
    if (!session.user) {
        return <LoggedOutLandingPage />
    }
    const frontpageVersion = QueryParams.frontpageVersion.decode(await searchParams)
    const capabilities = runCapabilities(session, {
        canEditFrontpage: Require.anyOf(
            frontpageAuth.updateSpecialCmsParagraphContentSection,
            frontpageAuth.updateSpecialCmsImage,
        ),
    })
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
}
