import styles from './page.module.scss'
import NotificationSettings from './notificationSettings'
import { getProfileForUserPage } from '@/app/users/[username]/(user-pages)/getProfileForUserPage'
import { notificationChannelOperations } from '@/services/notifications/channel/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { serverPage } from '@/app/serverPage'
import type { PageOperationArgs } from '@/app/serverPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'notifications', session)

        const [channels, subscriptions] = await Promise.all([
            notificationChannelOperations.readMany({}),
            notificationSubscriptionOperations.read({
                params: {
                    userId: profile.user.id
                },
            }),
        ])

        return { profile, channels, subscriptions }
    },
    render: ({ data }) => (
        <div className={styles.wrapper}>
            <h2>Notifikasjoner</h2>
            <NotificationSettings
                user={data.profile.user}
                channels={data.channels}
                subscriptions={data.subscriptions}
            />
        </div>
    ),
})

export default page
export { generateMetadata }
