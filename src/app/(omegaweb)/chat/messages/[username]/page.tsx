import { authorizeChatPage } from '@/app/(omegaweb)/chat/authorizeChatPage'
import ChatAccountNotice from '@/app/(omegaweb)/chat/ChatAccountNotice'
import { chatLinks } from '@/app/(omegaweb)/chat/links'
import { usernameOfPage } from '@/app/(omegaweb)/links'
import { chatUserOperations } from '@/services/chat/users/operations'
import { userOperations } from '@/services/users/operations'
import SiteLink from '@/components/SiteLink/SiteLink'
import { siteRedirect } from '@/app/domainContextOfRequest'
import { serverPage, withFallback } from '@/app/ServerPage'
import { externalHref } from '@/lib/sites/href'
import type { PageOperationArgs } from '@/app/ServerPage'

const { page, generateMetadata } = serverPage({
    operation: async ({ params, session }: PageOperationArgs<{ username: string }>) => {
        const user = authorizeChatPage(session)
        const username = usernameOfPage(params)
        const { user: recipient } = await userOperations.readProfile({ params: { username } })
        if (recipient.id === user.id) await siteRedirect(chatLinks.messages())

        const [directMessage, chatUser] = await Promise.all([
            chatUserOperations.readDirectMessage({ params: { userId: recipient.id } }),
            withFallback(chatUserOperations.read({ params: { userId: user.id } }), null, ['NOT FOUND']),
        ])
        return { recipient, directMessage, hasChatAccount: chatUser !== null }
    },
    metadata: ({ recipient }) => ({ title: `Melding til ${recipient.firstname}` }),
    render: ({ data: { recipient, directMessage, hasChatAccount } }) => (
        <div className="bg-base-100 rounded-round p-(--card-padding) flex flex-col gap-3">
            <h2 className="m-0">Melding til {recipient.firstname} {recipient.lastname}</h2>
            {directMessage.isOnChat ? <>
                <p className="m-0">Direktemeldinger ligger bare på chatten, så de vises ikke her ennå.</p>
                <ChatAccountNotice hasChatAccount={hasChatAccount} />
                {directMessage.url && (
                    <SiteLink href={externalHref(directMessage.url)} target="_blank">
                        Skriv til {recipient.firstname} i Element
                    </SiteLink>
                )}
            </> : (
                <p className="m-0">
                    {recipient.firstname} er ikke på chatten. En konto der får man første gang man logger inn på chatten.
                </p>
            )}
        </div>
    ),
})

export default page
export { generateMetadata }
