import styles from './page.module.scss'
import UserDotsInEditMode from './UserDotsInEditMode'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { dotOperations } from '@/services/dots/operations'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'dots', session)
        const dots = await dotOperations.readForUser({ params: { userId: profile.user.id } })
        return { profile, dots }
    },
    render: ({ data }) => (
        <div className={styles.wrapper}>
            <h2>Prikker</h2>
            <UserDotsInEditMode userId={data.profile.user.id} dots={data.dots} />
        </div>
    ),
})

export default page
export { generateMetadata }
