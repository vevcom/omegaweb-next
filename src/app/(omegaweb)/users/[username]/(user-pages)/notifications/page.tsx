import NotificationSettings from './NotificationSettings'
import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { manualNotificationChannelOperations } from '@/services/notifications/channels/manual/operations'
import { specialNotificationChannelOperations } from '@/services/notifications/channels/special/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { browserPushSubscriptionAuth } from '@/services/notifications/browserPushSubscription/auth'
import { pushIsConfigured, vapid } from '@/services/notifications/methods/constants'
import PushDeviceSettings from '@/components/PushNotifications/PushDeviceSettings'
import { serverPage } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'notifications', session)

        const [special, dynamic, subscriptions] = await Promise.all([
            specialNotificationChannelOperations.readMany({}),
            manualNotificationChannelOperations.readMany({}),
            notificationSubscriptionOperations.read({
                params: {
                    userId: profile.user.id
                },
            }),
        ])

        return { profile, channels: [...special, ...dynamic], subscriptions }
    },
    capabilities: (data) => ({
        canManagePushDevice: browserPushSubscriptionAuth.create.data({ userId: data.profile.user.id }),
    }),
    render: ({ data, capabilities }) => (
        <div className="bg-surface-base rounded-round p-(--card-padding)">
            <h2>Varslinger</h2>
            {capabilities.canManagePushDevice.authorized && (
                <PushDeviceSettings
                    userId={data.profile.user.id}
                    vapidPublicKey={pushIsConfigured ? vapid.publicKey : null}
                />
            )}
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
