import styles from './layout.module.scss'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import { userOperations } from '@/services/users/operations'
import { serverLayout, withFallback, withPageSession } from '@/app/serverPage'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import UserNavBar from '@/app/users/[username]/UserNavBar'
import { notFound } from 'next/navigation'
import type { LayoutOperationArgs } from '@/app/serverPage'
import type { PropTypes } from '@/app/users/[username]/page'
import type { Metadata } from 'next'
import type { SessionMaybeUser } from '@/auth/session/Session'

/**
 * "Min Side | Navn" on your own pages, "Navns sider" on someone else's - a name already ending in
 * an s-sound takes only the apostrophe, as Norwegian spells the genitive.
 */
function userPagesTitle(
    user: { firstname: string, lastname: string, username: string },
    session: SessionMaybeUser,
) {
    const name = `${user.firstname} ${user.lastname}`
    if (session.user?.username === user.username) return `Min Side | ${name}`
    return /[sxz]$/i.test(name) ? `${name}' sider` : `${name}s sider`
}

export async function generateMetadata({ params }: PropTypes): Promise<Metadata> {
    return withPageSession(async (session) => {
        const paramUsername = (await params).username
        const username = paramUsername === 'me' ? session.user?.username : paramUsername
        if (!username) return {}

        const profile = await withFallback(userOperations.readProfile({ params: { username } }), null)
        if (!profile) return {}
        return { title: userPagesTitle(profile.user, session) }
    })
}

export default serverLayout({
    operation: async ({ params, session }: LayoutOperationArgs<{ username: string }>) => {
        let username = params.username
        if (username === 'me') {
            if (!session.user) return notFound()
            username = session.user.username
        }

        // Guards the whole section: a username nobody may read gets no layout and no nav.
        const profile = await userOperations.readProfile({ params: { username } })
        return { username, user: profile.user }
    },
    render: ({ data: { username, user }, children, session }) => (
        <PageWrapper fillHeight transparent hideTitle>
            <PageTitleSetter title={userPagesTitle(user, session)} />
            <div className={styles.userAdminLayout}>
                <main className={styles.main}>
                    <div className={styles.mainInner}>
                        {children}
                    </div>
                </main>
                <UserNavBar username={username} userId={user.id} />
            </div>
        </PageWrapper>
    ),
})
