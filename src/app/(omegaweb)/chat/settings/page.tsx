import ChatPictureSetting from './ChatPictureSetting'
import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import { chatUserOperations } from '@/services/chat/users/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import { chatNotificationChannel } from '@/services/chat/chatNotificationChannel'
import { chatDirectAndGroupNotificationChannel } from '@/services/chat/directAndGroupNotificationChannel'
import UpdateNotificationSubscription from '@/components/Notifications/UpdateNotificationSubscription'
import { serverPage, withFallback } from '@/app/ServerPage'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { SubscribableChannel } from '@/components/Notifications/UpdateNotificationSubscription'

const { page, generateMetadata } = serverPage({
    operation: async ({ session }: PageOperationArgs) => {
        const userId = authorizeChatPage(session).id
        const [chatUser, spaces, chatChannel, directAndGroupChannel] = await Promise.all([
            withFallback(chatUserOperations.read({ params: { userId } }), null, ['NOT FOUND']),
            chatUserOperations.readSpaces({ params: { userId } }),
            chatNotificationChannel.read({}),
            chatDirectAndGroupNotificationChannel.read({}),
        ])
        const picture = chatUser && await chatUserOperations.readPicture({ params: { userId } })
        const subscriptions = await notificationSubscriptionOperations.read({
            params: {
                userId,
                channelIds: [
                    chatChannel.id,
                    directAndGroupChannel.id,
                    ...spaces.flatMap(space => [space.mentionsNotificationChannel.id, space.allNotificationChannel.id]),
                ],
            },
        })
        return {
            userId,
            hasChatAccount: chatUser !== null,
            picture,
            spaces,
            subscriptions,
            chatChannel,
            directAndGroupChannel,
        }
    },
    metadata: () => ({ title: 'Innstillinger for chatten' }),
    render: ({ data }) => {
        const { userId, hasChatAccount, picture, spaces, subscriptions } = data
        const subscriptionTo = (
            channel: SubscribableChannel,
            { shownAs = channel.name, hasChildren = false, depth = 0 }: {
                shownAs?: string,
                hasChildren?: boolean,
                depth?: number,
            } = {},
        ) => {
            const subscription = subscriptions.find(candidate => candidate.channelId === channel.id)
            return (
                <UpdateNotificationSubscription
                    userId={userId}
                    channel={{ ...channel, name: shownAs }}
                    methods={subscription?.methods ?? allNotificationMethodsOff}
                    inherited={!subscription?.explicit}
                    hasChildren={hasChildren}
                    depth={depth}
                />
            )
        }

        return (
            <div className="flex flex-col gap-4">
                <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                    <h2 className="m-0">Chatbilde</h2>
                    {hasChatAccount
                        ? <ChatPictureSetting userId={userId} picture={picture} />
                        : (
                            <p className="m-0 text-base-content/80">
                                Du får en konto på chatten første gang du logger inn der. Da kan du gi den et eget
                                bilde her.
                            </p>
                        )
                    }
                </div>

                <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col">
                    <h2 className="m-0">Varsler</h2>
                    <p className="m-0 mt-3 text-base-content/80">
                        Kanalen Chat gjelder alt på chatten, til du har valgt noe annet for en kanal under den.
                        Vil du ikke ha varsler fra chatten, slår du av alt der og lagrer med underkanaler.
                    </p>
                    {subscriptionTo(data.chatChannel, { hasChildren: true })}
                    {subscriptionTo(data.directAndGroupChannel, { depth: 1 })}
                </div>

                <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                    <h2 className="m-0">Varsler fra chatområder</h2>
                    {spaces.length === 0
                        ? <p className="m-0 text-base-content/80">Du er ikke med i noe chatområde.</p>
                        : <>
                            <p className="m-0 text-base-content/80">
                                For hvert chatområde velger du hvordan du varsles om meldinger som nevner deg, og
                                om alle andre meldinger. Før du har valgt, følger de innstillingene dine for
                                kanalen Chat over.
                            </p>
                            <ul className="m-0 p-0 list-none flex flex-col gap-4">
                                {spaces.map(space => (
                                    <li key={space.id} className="flex flex-col">
                                        <span className="font-medium">{space.name}</span>
                                        {subscriptionTo(space.mentionsNotificationChannel, { shownAs: 'Omtaler' })}
                                        {subscriptionTo(space.allNotificationChannel, { shownAs: 'Alle andre meldinger' })}
                                    </li>
                                ))}
                            </ul>
                        </>
                    }
                </div>
            </div>
        )
    },
})

export default page
export { generateMetadata }
