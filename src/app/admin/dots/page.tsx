import styles from './page.module.scss'
import SelectUserForDots from './SelectUserForDots'
import UserDots from '@/components/Dot/UserDots'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserSelectionProvider from '@/contexts/UserSelection'
import { UserPagingProvider } from '@/contexts/paging/UserPaging'
import { dotAuth } from '@/services/dots/auth'
import { Require } from '@/auth/authorizer/Require'
import { dotOperations } from '@/services/dots/operations'
import { userOperations } from '@/services/users/operations'
import { serverPage } from '@/app/serverPage'
import { authorizeAdminPage } from '@/app/admin/authorizeAdminPage'
import { QueryParams } from '@/lib/queryParams/queryParams'
import Link from 'next/link'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ searchParams, session }: PageOperationArgs) => {
        authorizeAdminPage('dots', session)
        const userId = QueryParams.userId.decode(searchParams)
        const onlyActive = QueryParams.onlyActive.decode(searchParams) ?? false

        if (userId === null) {
            return { userId: null, onlyActive } as const
        }

        const [user, dots] = await Promise.all([
            userOperations.readBasic({ params: { id: userId } }),
            dotOperations.readForUser({ params: { userId, onlyActive } }),
        ])

        return { userId, onlyActive, user, dots } as const
    },
    capabilities: (_, session) => ({
        // This page is only about administrating dots, so the crud of them is offered outright to
        // whoever is authorized for it - no edit mode to enter first.
        canCreate: session.user ? dotAuth.create.data({ userId: session.user.id }) : Require.user(),
        canUpdate: dotAuth.update,
        canDestroy: dotAuth.destroy,
    }),
    metadata: (data) => ({
        title: data.userId === null ? 'Prikker' : `Prikker for ${data.user.firstname} ${data.user.lastname}`,
    }),
    render: ({ data, capabilities }) => {
        if (data.userId === null) {
            return (
                <PageWrapper>
                    <div className={styles.wrapper}>
                        <i>Velg brukeren du vil se prikkene til</i>
                        <UserSelectionProvider>
                            <UserPagingProvider
                                startPage={{ page: 0, pageSize: 50 }}
                                serverRenderedData={[]}
                                details={{ partOfName: '', groups: [] }}
                            >
                                <SelectUserForDots />
                            </UserPagingProvider>
                        </UserSelectionProvider>
                    </div>
                </PageWrapper>
            )
        }

        return (
            <PageWrapper>
                <div className={styles.wrapper}>
                    <div className={styles.actions}>
                        <Link className={styles.action} href="/admin/dots">Velg en annen bruker</Link>
                        <Link className={styles.action} href={
                            `/admin/dots?${QueryParams.userId.encodeUrl(data.userId)}` +
                            `&${QueryParams.onlyActive.encodeUrl(!data.onlyActive)}`
                        }>
                            {data.onlyActive ? 'Vis alle prikker' : 'Vis kun aktive prikker'}
                        </Link>
                    </div>
                    <UserDots
                        userId={data.user.id}
                        dots={data.dots}
                        showCreateForm={capabilities.canCreate.authorized}
                        showUpdateForm={capabilities.canUpdate.authorized}
                        showDestroyForm={capabilities.canDestroy.authorized}
                    />
                </div>
            </PageWrapper>
        )
    },
})

export default page
export { generateMetadata }
