import { getProfileForUserPage } from '@/app/(omegaweb)/users/[username]/(user-pages)/getProfileForUserPage'
import { chatUserOperations } from '@/services/chat/users/operations'
import { manualChatSpaceOperations } from '@/services/manualChat/operations'
import { notificationSubscriptionOperations } from '@/services/notifications/subscription/operations'
import { allNotificationMethodsOff } from '@/services/notifications/constants'
import { chatClientOrigin } from '@/services/chat/constants'
import { chatNotificationChannel } from '@/services/chat/chatNotificationChannel'
import { chatDirectAndGroupNotificationChannel } from '@/services/chat/directAndGroupNotificationChannel'
import SiteLink from '@/components/SiteLink/SiteLink'
import UpdateNotificationSubscription from '@/components/Notifications/UpdateNotificationSubscription'
import { serverPage } from '@/app/ServerPage'
import { appHref, externalHref } from '@/lib/sites/href'
import { omegaLinks } from '@/app/(omegaweb)/links'
import type { PageOperationArgs } from '@/app/ServerPage'
import type { SubscribableChannel } from '@/components/Notifications/UpdateNotificationSubscription'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const { profile } = await getProfileForUserPage(params, 'chat', session)
        const ofUser = { params: { userId: profile.user.id } }
        const [{ hasChatAccount, spaces }, administeredSpaces, chatChannel, directAndGroupChannel] = await Promise.all([
            chatUserOperations.readSpaces(ofUser),
            manualChatSpaceOperations.readAdministered(ofUser),
            chatNotificationChannel.read({}),
            chatDirectAndGroupNotificationChannel.read({}),
        ])
        const subscriptions = await notificationSubscriptionOperations.read({
            params: {
                userId: profile.user.id,
                channelIds: [
                    chatChannel.id,
                    directAndGroupChannel.id,
                    ...spaces.flatMap(space => [space.mentionsNotificationChannel.id, space.allNotificationChannel.id]),
                ],
            },
        })
        return {
            userId: profile.user.id,
            hasChatAccount,
            spaces,
            subscriptions,
            administeredSpaces,
            chatChannel,
            directAndGroupChannel,
            chatClientOrigin,
        }
    },
    render: ({ data }) => {
        const { userId, hasChatAccount, spaces, subscriptions, administeredSpaces, chatClientOrigin: chat } = data
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
                    <h2 className="m-0">Chat</h2>
                    <p className="m-0">
                        {hasChatAccount
                            ? 'Du logger inn på chatten med samme innlogging som her.'
                            : 'Du får en konto på chatten første gang du logger inn der, med samme innlogging som her.'}
                    </p>
                    {chat && <SiteLink href={externalHref(chat)} target="_blank">Åpne chatten</SiteLink>}
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
                    <h2 className="m-0">Chatområder</h2>
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
                                        <div className="flex flex-row flex-wrap items-baseline gap-x-3 gap-y-1">
                                            <span className="font-medium">{space.name}</span>
                                            {space.committee && (
                                                <SiteLink
                                                    href={omegaLinks.committee(space.committee)}
                                                    className="text-base-content/80"
                                                >
                                                Komiteen
                                                </SiteLink>
                                            )}
                                        </div>
                                        {subscriptionTo(space.mentionsNotificationChannel, { shownAs: 'Omtaler' })}
                                        {subscriptionTo(space.allNotificationChannel, { shownAs: 'Alle andre meldinger' })}
                                    </li>
                                ))}
                            </ul>
                        </>
                    }
                </div>

                {administeredSpaces.length > 0 && (
                    <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
                        <h2 className="m-0">Chatområder du styrer</h2>
                        <ul className="m-0 p-0 list-none flex flex-col gap-2">
                            {administeredSpaces.map(space => (
                                <li key={space.id}>
                                    <SiteLink href={appHref(`/admin/chat-spaces/${space.id}`)}>{space.name}</SiteLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        )
    },
})

export default page
export { generateMetadata }
